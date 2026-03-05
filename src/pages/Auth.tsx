import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Briefcase } from 'lucide-react';

const Auth = () => {
  const { user, loading, signIn, signUp } = useAuth();
  const { toast } = useToast();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [notAllowed, setNotAllowed] = useState(false);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (user && !notAllowed) return <Navigate to="/" replace />;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setNotAllowed(false);

    if (isSignUp) {
      // Check allowlist before signup
      const { data: allowed } = await supabase.rpc('check_user_allowed', {
        check_email: email,
      } as any);

      if (!allowed) {
        toast({
          title: 'Access not approved',
          description: 'Your email is not in the approved users list. Please contact an administrator.',
          variant: 'destructive',
        });
        setSubmitting(false);
        return;
      }

      const { error } = await signUp(email, password, fullName);
      if (error) {
        toast({ title: 'Error', description: error.message, variant: 'destructive' });
      } else {
        toast({ title: 'Account created', description: 'You can now sign in.' });
      }
    } else {
      const { error } = await signIn(email, password);
      if (error) {
        toast({ title: 'Error', description: error.message, variant: 'destructive' });
      } else {
        // After sign-in, check allowlist and auto-assign role if first login
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          const { data: allowed } = await supabase.rpc('check_user_allowed', {
            check_email: session.user.email || '',
          } as any);

          if (!allowed) {
            setNotAllowed(true);
            toast({
              title: 'Access not approved',
              description: 'Your email is not in the approved users list.',
              variant: 'destructive',
            });
            await supabase.auth.signOut();
            setSubmitting(false);
            return;
          }

          // Auto-assign role on first login
          const { data: allowEntry } = await supabase
            .from('allowed_users')
            .select('id, role_to_assign, used_at')
            .eq('email', (session.user.email || '').toLowerCase())
            .single();

          if (allowEntry && !allowEntry.used_at) {
            await supabase.from('user_roles').insert({
              user_id: session.user.id,
              role: allowEntry.role_to_assign,
            } as any);
            await supabase
              .from('allowed_users')
              .update({ used_at: new Date().toISOString() } as any)
              .eq('id', allowEntry.id);
          }
        }
      }
    }
    setSubmitting(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
      <Card className="w-full max-w-md shadow-soft border-0">
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto w-12 h-12 rounded-lg bg-primary flex items-center justify-center">
            <Briefcase className="h-6 w-6 text-primary-foreground" />
          </div>
          <CardTitle className="text-2xl">Hiring Manager Review Tracker</CardTitle>
          <CardDescription>
            {isSignUp ? 'Create your account' : 'Sign in to continue'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {isSignUp && (
              <div className="space-y-2">
                <Label htmlFor="fullName">Full Name</Label>
                <Input
                  id="fullName"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Your full name"
                  required
                />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
              />
            </div>
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? 'Please wait...' : isSignUp ? 'Create Account' : 'Sign In'}
            </Button>
          </form>
          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={() => { setIsSignUp(!isSignUp); setNotAllowed(false); }}
              className="text-sm text-primary hover:underline"
            >
              {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;
