import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Trash2, Loader2, AlertTriangle } from "lucide-react";

export function TerminateAccountDialog() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  const confirmPhrase = "DELETE MY ACCOUNT";

  const handleTerminate = async () => {
    if (confirmText !== confirmPhrase) {
      toast.error("Please type the confirmation phrase exactly");
      return;
    }

    setIsDeleting(true);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        toast.error("You must be logged in to terminate your account");
        return;
      }

      const { data, error } = await supabase.functions.invoke("terminate-account", {
        headers: {
          Authorization: `Bearer ${sessionData.session.access_token}`,
        },
      });

      if (error) throw error;

      if (!data.success) {
        throw new Error(data.error || "Failed to terminate account");
      }

      toast.success("Your account has been permanently deleted");
      
      // Sign out and redirect to auth page
      await signOut();
      navigate("/auth");
    } catch (error) {
      console.error("Failed to terminate account:", error);
      toast.error("Failed to terminate account. Please try again.");
    } finally {
      setIsDeleting(false);
      setIsOpen(false);
      setConfirmText("");
    }
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={setIsOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="destructive" className="gap-2">
          <Trash2 className="h-4 w-4" />
          Terminate Account
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <div className="flex items-center gap-3 text-destructive">
            <AlertTriangle className="h-6 w-6" />
            <AlertDialogTitle>Terminate Account</AlertDialogTitle>
          </div>
          <AlertDialogDescription className="space-y-3 pt-2">
            <p className="font-semibold text-destructive">
              This action is permanent and cannot be undone.
            </p>
            <p>
              Terminating your account will permanently delete:
            </p>
            <ul className="list-disc list-inside space-y-1 text-sm">
              <li>Your profile and personal information</li>
              <li>All your roles and permissions</li>
              <li>Your notification preferences</li>
              <li>All data associated with your account</li>
            </ul>
            <p className="text-sm">
              Your email <span className="font-medium">{profile?.email}</span> will be available
              for new signups after termination.
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-2 py-4">
          <Label htmlFor="confirm-delete">
            Type <span className="font-mono font-bold text-destructive">{confirmPhrase}</span> to confirm:
          </Label>
          <Input
            id="confirm-delete"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder="Type confirmation phrase"
            className="font-mono"
          />
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
          <Button
            variant="destructive"
            onClick={handleTerminate}
            disabled={confirmText !== confirmPhrase || isDeleting}
          >
            {isDeleting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Terminating...
              </>
            ) : (
              "Permanently Delete Account"
            )}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
