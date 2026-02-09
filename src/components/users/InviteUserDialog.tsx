import { useState, useEffect } from "react";
import { z } from "zod";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { invokeEdgeFn, networkErrorMessage } from "@/lib/network-utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, UserPlus, Mail, User, Shield, GitBranch, Briefcase, Key, Eye, EyeOff } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { ROLE_LABELS, type AppRole } from "@/lib/constants";

interface InviteUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

interface Line {
  id: string;
  line_id: string;
  name: string | null;
}

const ASSIGNABLE_ROLES: AppRole[] = ['worker', 'admin', 'storage', 'cutting'];
const DEPARTMENTS = ['sewing', 'finishing', 'both'] as const;
type Department = typeof DEPARTMENTS[number];

const inviteUserSchema = z.object({
  email: z.string().email("Invalid email address").max(255, "Email too long"),
  fullName: z.string().min(1, "Full name is required").max(100, "Name too long"),
  role: z.enum(["worker", "admin", "storage", "cutting"]),
  department: z.enum(["sewing", "finishing", "both"]),
  temporaryPassword: z.string().min(6, "Password must be at least 6 characters").max(100, "Password too long").optional(),
});

export function InviteUserDialog({ open, onOpenChange, onSuccess }: InviteUserDialogProps) {
  const { profile, hasRole } = useAuth();
  const [loading, setLoading] = useState(false);
  const [lines, setLines] = useState<Line[]>([]);
  const [selectedLineIds, setSelectedLineIds] = useState<string[]>([]);
  const [useTemporaryPassword, setUseTemporaryPassword] = useState(false);
  const [temporaryPassword, setTemporaryPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    fullName: "",
    role: "worker" as AppRole,
    department: "both" as Department,
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Admins can invite all roles including other admins
  const availableRoles = hasRole('admin') || hasRole('owner')
    ? ASSIGNABLE_ROLES 
    : ASSIGNABLE_ROLES.filter(r => r !== 'admin');

  useEffect(() => {
    if (open && profile?.factory_id) {
      fetchLines();
    }
  }, [open, profile?.factory_id]);

  async function fetchLines() {
    if (!profile?.factory_id) return;

    const { data } = await supabase
      .from('lines')
      .select('id, line_id, name')
      .eq('factory_id', profile.factory_id)
      .eq('is_active', true);

    if (data) {
      // Sort numerically by extracting number from line_id
      const sorted = [...data].sort((a, b) => {
        const numA = parseInt(a.line_id.replace(/\D/g, '')) || 0;
        const numB = parseInt(b.line_id.replace(/\D/g, '')) || 0;
        return numA - numB;
      });
      setLines(sorted);
    }
  }

  function toggleLine(lineId: string) {
    setSelectedLineIds(prev => 
      prev.includes(lineId) 
        ? prev.filter(id => id !== lineId)
        : [...prev, lineId]
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!profile?.factory_id) return;

    const dataToValidate = {
      email: formData.email,
      fullName: formData.fullName,
      role: formData.role,
      department: formData.department,
      temporaryPassword: useTemporaryPassword ? temporaryPassword : undefined,
    };

    const result = inviteUserSchema.safeParse(dataToValidate);
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.errors.forEach((err) => {
        if (err.path[0]) fieldErrors[err.path[0] as string] = err.message;
      });
      setFormErrors(fieldErrors);
      return;
    }
    setFormErrors({});

    setLoading(true);

    try {
      // Use edge function to create user (doesn't affect current session)
      const { data, error } = await invokeEdgeFn('admin-invite-user', {
        email: formData.email,
        fullName: formData.fullName,
        factoryId: profile.factory_id,
        role: formData.role,
        department: formData.role === 'worker' ? formData.department : null,
        // Storage and cutting roles get all lines automatically, workers get selected lines
        lineIds: formData.role === 'worker'
          ? selectedLineIds
          : ['storage', 'cutting'].includes(formData.role)
            ? lines.map(l => l.id)
            : [],
        temporaryPassword: useTemporaryPassword ? temporaryPassword : undefined,
      });

      if (error) {
        console.error("Invite error:", error);
        toast.error(networkErrorMessage(error));
        return;
      }

      if (data?.error) {
        toast.error(data.error);
        return;
      }

      // Send welcome email
      try {
        const { data: factoryData } = await supabase
          .from('factory_accounts')
          .select('name')
          .eq('id', profile.factory_id)
          .single();

        await invokeEdgeFn('send-welcome-email', {
          email: formData.email,
          fullName: formData.fullName,
          resetLink: `${window.location.origin}/reset-password`,
          factoryName: factoryData?.name,
        });
      } catch (emailErr) {
        console.error("Welcome email error:", emailErr);
        // Don't block success if email fails
      }

      toast.success(
        useTemporaryPassword 
          ? `User ${formData.fullName} created with temporary password` 
          : `User ${formData.fullName} invited successfully`
      );
      onSuccess();
      onOpenChange(false);
      setFormData({ email: "", fullName: "", role: "worker", department: "both" });
      setSelectedLineIds([]);
      setUseTemporaryPassword(false);
      setTemporaryPassword("");
      setShowPassword(false);
    } catch (error) {
      console.error("Error inviting user:", error);
      toast.error("Failed to invite user");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Invite New User
          </DialogTitle>
          <DialogDescription>
            Add a new user to your factory. They will receive an email to set their password.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="fullName" className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              Full Name
            </Label>
            <Input
              id="fullName"
              value={formData.fullName}
              onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
              placeholder="Enter full name"
              required
            />
            {formErrors.fullName && <p className="text-sm text-destructive">{formErrors.fullName}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="email" className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-muted-foreground" />
              Email Address
            </Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="user@example.com"
              required
            />
            {formErrors.email && <p className="text-sm text-destructive">{formErrors.email}</p>}
          </div>

          {/* Temporary Password Toggle */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border">
            <div className="flex items-center gap-2">
              <Key className="h-4 w-4 text-muted-foreground" />
              <div>
                <Label htmlFor="usePassword" className="text-sm font-medium cursor-pointer">
                  Set temporary password
                </Label>
                <p className="text-xs text-muted-foreground">
                  For in-person onboarding without email
                </p>
              </div>
            </div>
            <Switch
              id="usePassword"
              checked={useTemporaryPassword}
              onCheckedChange={setUseTemporaryPassword}
            />
          </div>

          {/* Temporary Password Input */}
          {useTemporaryPassword && (
            <div className="space-y-2">
              <Label htmlFor="temporaryPassword" className="flex items-center gap-2">
                <Key className="h-4 w-4 text-muted-foreground" />
                Temporary Password
              </Label>
              <div className="relative">
                <Input
                  id="temporaryPassword"
                  type={showPassword ? "text" : "password"}
                  value={temporaryPassword}
                  onChange={(e) => setTemporaryPassword(e.target.value)}
                  placeholder="Enter a temporary password"
                  minLength={6}
                  required={useTemporaryPassword}
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Eye className="h-4 w-4 text-muted-foreground" />
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Share this password with the user. They should change it after first login.
              </p>
              {formErrors.temporaryPassword && <p className="text-sm text-destructive">{formErrors.temporaryPassword}</p>}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="role" className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-muted-foreground" />
              Role
            </Label>
            <Select
              value={formData.role}
              onValueChange={(value: AppRole) => setFormData({ ...formData, role: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select role" />
              </SelectTrigger>
              <SelectContent>
                {availableRoles.map((role) => (
                  <SelectItem key={role} value={role}>
                    {ROLE_LABELS[role]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Department selector - only for workers */}
          {formData.role === 'worker' && (
            <div className="space-y-2">
              <Label htmlFor="department" className="flex items-center gap-2">
                <Briefcase className="h-4 w-4 text-muted-foreground" />
                Department
              </Label>
              <Select
                value={formData.department}
                onValueChange={(value: Department) => setFormData({ ...formData, department: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select department" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sewing">Sewing Only</SelectItem>
                  <SelectItem value="finishing">Finishing Only</SelectItem>
                  <SelectItem value="both">Both Sewing & Finishing</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                This determines which update form the worker can access.
              </p>
            </div>
          )}

          {/* Line assignments - only for workers (storage and cutting get all lines automatically) */}
          {formData.role === 'worker' && (
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <GitBranch className="h-4 w-4 text-muted-foreground" />
                Assigned Lines
                {selectedLineIds.length > 0 && (
                  <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                    {selectedLineIds.length} selected
                  </span>
                )}
              </Label>
              <ScrollArea className="h-32 border rounded-md p-2">
                {lines.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No lines available
                  </p>
                ) : (
                  <div className="space-y-2">
                    {lines.map((line) => (
                      <div key={line.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={`line-${line.id}`}
                          checked={selectedLineIds.includes(line.id)}
                          onCheckedChange={() => toggleLine(line.id)}
                        />
                        <label
                          htmlFor={`line-${line.id}`}
                          className="text-sm cursor-pointer flex-1"
                        >
                          {line.name || line.line_id}
                        </label>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
              <p className="text-xs text-muted-foreground">
                Select which lines this worker can submit updates for.
              </p>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Inviting...</>
              ) : (
                'Invite User'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
