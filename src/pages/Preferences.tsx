import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "next-themes";
import { supabase } from "@/integrations/supabase/client";
import { NotificationPreferences } from "@/components/NotificationPreferences";
import { TerminateAccountDialog } from "@/components/TerminateAccountDialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2, Settings2, Bell, Palette, Globe, Sun, Moon, Monitor, AlertTriangle, User, KeyRound, Eye, EyeOff, Pencil, ChevronDown } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

type Language = 'en' | 'bn' | 'zh';

const LANGUAGES = [
  { value: 'en', label: 'English', nativeLabel: 'English' },
  { value: 'bn', label: 'বাংলা', nativeLabel: 'Bangla' },
  { value: 'zh', label: '中文', nativeLabel: 'Chinese' },
] as const;

export default function Preferences() {
  const { t, i18n } = useTranslation();
  const { user, profile, loading, factory, isAdminOrHigher } = useAuth();

  const location = useLocation();
  const notificationsRef = useRef<HTMLDivElement>(null);
  const { theme, setTheme } = useTheme();
  const [language, setLanguage] = useState<Language>(() => {
    return (localStorage.getItem('app-language') as Language) || 'en';
  });
  const [mounted, setMounted] = useState(false);

  // Profile editing state
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);

  // Password change state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [editingProfile, setEditingProfile] = useState(false);
  const [editingPassword, setEditingPassword] = useState(false);

  // Initialize profile fields when profile loads
  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || '');
      setPhone(profile.phone || '');
    }
  }, [profile]);

  const handleSaveProfile = async () => {
    if (!user || !fullName.trim()) {
      toast.error(t('modals.nameRequired'));
      return;
    }

    setProfileSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ full_name: fullName.trim(), phone: phone.trim() || null })
        .eq('id', user.id);

      if (error) throw error;
      toast.success(t('modals.profileUpdated'));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t('modals.failedToUpdateProfile');
      toast.error(message);
    } finally {
      setProfileSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (!user || !currentPassword || !newPassword) return;

    if (newPassword.length < 8) {
      toast.error(t('modals.newPasswordMinLength'));
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error(t('modals.newPasswordsDontMatch'));
      return;
    }

    setPasswordSaving(true);
    try {
      // Verify current password by re-authenticating
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email!,
        password: currentPassword,
      });
      if (signInError) {
        toast.error(t('modals.currentPasswordIncorrect'));
        return;
      }

      // Update to new password
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;

      toast.success(t('modals.passwordUpdated'));
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t('modals.failedToUpdatePassword');
      toast.error(message);
    } finally {
      setPasswordSaving(false);
    }
  };

  // Scroll to notifications section when hash is #notifications
  useEffect(() => {
    if (location.hash === '#notifications' && notificationsRef.current) {
      notificationsRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [location.hash]);

  const handleLanguageChange = (value: Language) => {
    setLanguage(value);
    localStorage.setItem('app-language', value);
    i18n.changeLanguage(value);
  };

  // Prevent hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!profile?.factory_id) {
    return (
      <div className="flex min-h-[400px] items-center justify-center p-4">
        <Card className="max-w-md">
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">
              {t('preferences.needFactory')}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <Settings2 className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">{t('preferences.title')}</h1>
          <p className="text-sm text-muted-foreground">
            {t('preferences.description')}
          </p>
        </div>
      </div>

      {/* Profile & Security Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <User className="h-5 w-5 text-muted-foreground" />
            <CardTitle>{t('modals.profileAndSecurity')}</CardTitle>
          </div>
          <CardDescription>
            {t('modals.accountInfo')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Read-only summary */}
          <div className="grid gap-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">{t('modals.name')}</span>
              <span className="font-medium">{profile?.full_name}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">{t('modals.email')}</span>
              <span className="font-medium">{user?.email}</span>
            </div>
            {profile?.phone && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">{t('modals.phone')}</span>
                <span className="font-medium">{profile.phone}</span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">{t('modals.password')}</span>
              <span className="font-medium">••••••••</span>
            </div>
          </div>

          {/* Edit Profile collapsible */}
          <Collapsible open={editingProfile} onOpenChange={setEditingProfile}>
            <CollapsibleTrigger asChild>
              <Button variant="outline" size="sm" className="w-full">
                <Pencil className="h-3.5 w-3.5 mr-2" />
                {t('modals.editProfile')}
                <ChevronDown className={`h-3.5 w-3.5 ml-auto transition-transform ${editingProfile ? 'rotate-180' : ''}`} />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-4 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="fullName">{t('modals.fullName')}</Label>
                <Input
                  id="fullName"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder={t('modals.fullNamePlaceholder')}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">{t('modals.phone')}</Label>
                <Input
                  id="phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder={t('modals.phonePlaceholder')}
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={handleSaveProfile} disabled={profileSaving || !fullName.trim()}>
                  {profileSaving ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> {t('modals.saving')}</>
                  ) : (
                    t('modals.save')
                  )}
                </Button>
                <Button variant="ghost" onClick={() => {
                  setEditingProfile(false);
                  setFullName(profile?.full_name || '');
                  setPhone(profile?.phone || '');
                }}>
                  {t('modals.cancel')}
                </Button>
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Change Password collapsible */}
          <Collapsible open={editingPassword} onOpenChange={setEditingPassword}>
            <CollapsibleTrigger asChild>
              <Button variant="outline" size="sm" className="w-full">
                <KeyRound className="h-3.5 w-3.5 mr-2" />
                {t('modals.changePassword')}
                <ChevronDown className={`h-3.5 w-3.5 ml-auto transition-transform ${editingPassword ? 'rotate-180' : ''}`} />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-4 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="currentPassword">{t('modals.currentPassword')}</Label>
                <div className="relative">
                  <Input
                    id="currentPassword"
                    type={showCurrentPassword ? "text" : "password"}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder={t('modals.currentPasswordPlaceholder')}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full px-3"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  >
                    {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="newPassword">{t('modals.newPassword')}</Label>
                <div className="relative">
                  <Input
                    id="newPassword"
                    type={showNewPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder={t('modals.newPasswordPlaceholder')}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full px-3"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                  >
                    {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">{t('modals.confirmNewPassword')}</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder={t('modals.confirmNewPasswordPlaceholder')}
                />
                {confirmPassword && newPassword !== confirmPassword && (
                  <p className="text-xs text-destructive">{t('modals.passwordsDontMatch')}</p>
                )}
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={handleChangePassword}
                  disabled={passwordSaving || !currentPassword || !newPassword || newPassword !== confirmPassword}
                >
                  {passwordSaving ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> {t('modals.updatingPassword')}</>
                  ) : (
                    t('modals.updatePassword')
                  )}
                </Button>
                <Button variant="ghost" onClick={() => {
                  setEditingPassword(false);
                  setCurrentPassword('');
                  setNewPassword('');
                  setConfirmPassword('');
                }}>
                  {t('modals.cancel')}
                </Button>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </CardContent>
      </Card>

      {/* Display Preferences Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Palette className="h-5 w-5 text-muted-foreground" />
            <CardTitle>{t('preferences.displaySettings')}</CardTitle>
          </div>
          <CardDescription>
            {t('preferences.displayDescription')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Theme Selection */}
          <div className="space-y-3">
            <Label className="text-base font-medium">{t('preferences.theme')}</Label>
            <p className="text-sm text-muted-foreground">
              {t('preferences.themeDescription')}
            </p>
            {mounted && (
              <RadioGroup
                value={theme}
                onValueChange={setTheme}
                className="grid grid-cols-3 gap-4"
              >
                <Label
                  htmlFor="theme-light"
                  className={`flex flex-col items-center justify-center rounded-lg border-2 p-4 cursor-pointer transition-all ${
                    theme === 'light' ? 'border-primary bg-primary/5' : 'border-muted hover:border-muted-foreground/50'
                  }`}
                >
                  <RadioGroupItem value="light" id="theme-light" className="sr-only" />
                  <Sun className="h-6 w-6 mb-2" />
                  <span className="text-sm font-medium">{t('preferences.light')}</span>
                </Label>
                
                <Label
                  htmlFor="theme-dark"
                  className={`flex flex-col items-center justify-center rounded-lg border-2 p-4 cursor-pointer transition-all ${
                    theme === 'dark' ? 'border-primary bg-primary/5' : 'border-muted hover:border-muted-foreground/50'
                  }`}
                >
                  <RadioGroupItem value="dark" id="theme-dark" className="sr-only" />
                  <Moon className="h-6 w-6 mb-2" />
                  <span className="text-sm font-medium">{t('preferences.dark')}</span>
                </Label>
                
                <Label
                  htmlFor="theme-system"
                  className={`flex flex-col items-center justify-center rounded-lg border-2 p-4 cursor-pointer transition-all ${
                    theme === 'system' ? 'border-primary bg-primary/5' : 'border-muted hover:border-muted-foreground/50'
                  }`}
                >
                  <RadioGroupItem value="system" id="theme-system" className="sr-only" />
                  <Monitor className="h-6 w-6 mb-2" />
                  <span className="text-sm font-medium">{t('preferences.system')}</span>
                </Label>
              </RadioGroup>
            )}
          </div>

          {/* Language Selection */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Globe className="h-4 w-4 text-muted-foreground" />
              <Label className="text-base font-medium">{t('preferences.language')}</Label>
            </div>
            <p className="text-sm text-muted-foreground">
              {t('preferences.languageDescription')}
            </p>
            <Select value={language} onValueChange={handleLanguageChange}>
              <SelectTrigger className="w-full max-w-xs">
                <SelectValue placeholder={t('preferences.language')} />
              </SelectTrigger>
              <SelectContent>
                {LANGUAGES.map((lang) => (
                  <SelectItem key={lang.value} value={lang.value}>
                    <span className="flex items-center gap-2">
                      <span>{lang.label}</span>
                      {lang.value !== 'en' && (
                        <span className="text-muted-foreground">({lang.nativeLabel})</span>
                      )}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Notification Preferences Section */}
      <Card ref={notificationsRef} id="notifications">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-muted-foreground" />
            <CardTitle>{t('preferences.notifications')}</CardTitle>
          </div>
          <CardDescription>
            {t('preferences.notificationsDescription')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <NotificationPreferences />
        </CardContent>
      </Card>

      {/* Danger Zone - Terminate Account */}
      <Card className="border-destructive/50">
        <CardHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <CardTitle className="text-destructive">{t('modals.dangerZone')}</CardTitle>
          </div>
          <CardDescription>
            {t('modals.dangerZoneDesc')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 rounded-lg border border-destructive/30 bg-destructive/5">
              <div className="space-y-1">
                <p className="font-medium">{t('modals.terminateAccount')}</p>
                <p className="text-sm text-muted-foreground">
                  {t('modals.terminateActionPermanent')}
                </p>
              </div>
              <TerminateAccountDialog />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
