import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  Loader2,
  CreditCard,
  ArrowLeft,
  RefreshCw,
  CheckCircle2,
  Calendar,
  DollarSign,
} from 'lucide-react';
import { formatPlanPrice } from '@/lib/plan-tiers';

interface PaymentRecord {
  id: string;
  amount: number;
  currency: string;
  status: string;
  description: string | null;
  tier: string | null;
  interval: string | null;
  created_at: string;
}

export default function PaymentMethod() {
  const { factory, isAdminOrHigher } = useAuth();
  const navigate = useNavigate();
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPaymentHistory();
  }, [factory]);

  const fetchPaymentHistory = async () => {
    if (!factory?.id) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('worldpay_payments')
        .select('*')
        .eq('factory_id', factory.id)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      setPayments((data as PaymentRecord[]) || []);
    } catch (err) {
      console.error('Error fetching payment history:', err);
      toast.error('Failed to load payment history');
    } finally {
      setLoading(false);
    }
  };

  if (!isAdminOrHigher()) {
    navigate('/dashboard');
    return null;
  }

  if (factory?.payment_provider !== 'worldpay') {
    navigate('/billing-plan');
    return null;
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'authorized':
      case 'settled':
        return <Badge className="bg-green-600">Paid</Badge>;
      case 'refused':
        return <Badge variant="destructive">Failed</Badge>;
      case 'refunded':
        return <Badge variant="secondary">Refunded</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="container max-w-4xl py-3 md:py-4 lg:py-6 px-4">
      <div className="flex items-center gap-3 mb-8">
        <Button variant="ghost" size="icon" onClick={() => navigate('/billing-plan')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="h-10 w-10 rounded-xl bg-slate-500/10 flex items-center justify-center">
          <CreditCard className="h-5 w-5 text-slate-600 dark:text-slate-400" />
        </div>
        <div>
          <h1 className="text-xl md:text-2xl font-bold">Payment Method</h1>
          <p className="text-sm text-muted-foreground">
            Manage your card and view payment history
          </p>
        </div>
      </div>

      {/* Current Subscription Info */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-600" />
            Subscription Active
          </CardTitle>
          <CardDescription>
            {factory.subscription_tier?.charAt(0).toUpperCase()}{factory.subscription_tier?.slice(1)} plan
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4 text-sm">
            <div className="flex items-center gap-1.5">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span>Status: <span className="font-medium capitalize">{factory.subscription_status}</span></span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Payment History */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Payment History</CardTitle>
              <CardDescription>Your recent payments</CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={fetchPaymentHistory}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : payments.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <DollarSign className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No payment history yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {payments.map((payment) => (
                <div
                  key={payment.id}
                  className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                      <DollarSign className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">
                        {payment.description || `${payment.tier || 'Subscription'} payment`}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(payment.created_at).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold">
                      {formatPlanPrice(payment.amount)}
                    </span>
                    {getStatusBadge(payment.status)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
