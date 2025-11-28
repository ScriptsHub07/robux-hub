import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { WithdrawModal } from "@/components/WithdrawModal";
import { 
  DollarSign, 
  Package, 
  Star, 
  TrendingUp,
  Settings,
  Clock,
  CheckCircle,
  Loader2,
  RefreshCw,
  Banknote
} from "lucide-react";
import { Tables } from "@/integrations/supabase/types";

type Seller = Tables<"sellers">;
type Order = Tables<"orders"> & {
  profiles: {
    username: string;
  };
};

export default function SellerPanel() {
  const [user, setUser] = useState<any>(null);
  const [seller, setSeller] = useState<Seller | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pricePerK, setPricePerK] = useState("");
  const [minAmount, setMinAmount] = useState("");
  const [maxAmount, setMaxAmount] = useState("");
  const [isOnline, setIsOnline] = useState(false);
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [balance, setBalance] = useState(0);
  const navigate = useNavigate();
  const { toast } = useToast();

  const refreshBalance = async () => {
    if (!user?.id) return;
    const { data } = await supabase
      .from("profiles")
      .select("balance")
      .eq("id", user.id)
      .single();
    if (data) setBalance(Number(data.balance));
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setUser(session?.user ?? null);
        if (!session?.user) {
          navigate("/auth");
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.user) {
        navigate("/auth");
      } else {
        setUser(session.user);
        fetchSellerData(session.user.id);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const fetchSellerData = async (userId: string) => {
    try {
      setLoading(true);

      const { data: sellerData, error } = await supabase
        .from("sellers")
        .select("*")
        .eq("user_id", userId)
        .single();

      if (error || !sellerData) {
        toast({
          title: "Acesso negado",
          description: "Você não é um vendedor cadastrado",
          variant: "destructive",
        });
        navigate("/dashboard");
        return;
      }

      setSeller(sellerData);
      setPricePerK(sellerData.price_per_1k.toString());
      setMinAmount(sellerData.min_amount.toString());
      setMaxAmount(sellerData.max_amount.toString());
      setIsOnline(sellerData.is_online);

      // Fetch user balance
      const { data: profileData } = await supabase
        .from("profiles")
        .select("balance")
        .eq("id", userId)
        .single();
      if (profileData) setBalance(Number(profileData.balance));

      // Fetch orders for this seller
      const { data: ordersData } = await supabase
        .from("orders")
        .select(`
          *,
          profiles:buyer_id (
            username
          )
        `)
        .eq("seller_id", sellerData.id)
        .order("created_at", { ascending: false });

      setOrders((ordersData as Order[]) || []);
    } catch (error: any) {
      console.error("Error fetching seller data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSettings = async () => {
    if (!seller) return;

    try {
      setSaving(true);

      const { error } = await supabase
        .from("sellers")
        .update({
          price_per_1k: parseFloat(pricePerK),
          min_amount: parseInt(minAmount),
          max_amount: parseInt(maxAmount),
          is_online: isOnline,
        })
        .eq("id", seller.id);

      if (error) throw error;

      toast({
        title: "Configurações salvas!",
        description: "Suas alterações foram aplicadas",
      });
    } catch (error: any) {
      toast({
        title: "Erro ao salvar",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateOrderStatus = async (orderId: string, newStatus: string) => {
    try {
      const updateData: any = { status: newStatus };
      if (newStatus === "completed") {
        updateData.completed_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from("orders")
        .update(updateData)
        .eq("id", orderId);

      if (error) throw error;

      setOrders(orders.map(o => 
        o.id === orderId ? { ...o, status: newStatus as any } : o
      ));

      toast({
        title: "Status atualizado!",
        description: `Pedido marcado como ${newStatus}`,
      });
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
      pending: { variant: "secondary", label: "Pendente" },
      processing: { variant: "default", label: "Processando" },
      completed: { variant: "outline", label: "Concluído" },
      cancelled: { variant: "destructive", label: "Cancelado" },
      disputed: { variant: "destructive", label: "Disputado" },
    };
    const config = statusConfig[status] || statusConfig.pending;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar user={user} />
        <div className="pt-24 flex justify-center items-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  const pendingOrders = orders.filter(o => o.status === "pending");
  const processingOrders = orders.filter(o => o.status === "processing");
  const completedOrders = orders.filter(o => o.status === "completed");
  const totalEarnings = completedOrders.reduce((acc, o) => acc + Number(o.total_price), 0);

  return (
    <div className="min-h-screen bg-background">
      <Navbar user={user} />
      
      <div className="container mx-auto px-4 pt-24 pb-12">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-2">Painel do Vendedor</h1>
            <p className="text-muted-foreground">Gerencie seus preços e pedidos</p>
          </div>
          <Button variant="outline" onClick={() => navigate("/dashboard")}>
            Voltar ao Dashboard
          </Button>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card className="bg-gradient-to-br from-primary/20 to-primary/5 border-primary/20">
            <CardHeader className="pb-2">
              <CardDescription>Total Ganho</CardDescription>
              <CardTitle className="text-2xl flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-primary" />
                R$ {totalEarnings.toFixed(2)}
              </CardTitle>
            </CardHeader>
          </Card>

          <Card className="bg-card/50">
            <CardHeader className="pb-2">
              <CardDescription>Total de Vendas</CardDescription>
              <CardTitle className="text-2xl flex items-center gap-2">
                <Package className="w-5 h-5 text-accent" />
                {seller?.total_sales || 0}
              </CardTitle>
            </CardHeader>
          </Card>

          <Card className="bg-card/50">
            <CardHeader className="pb-2">
              <CardDescription>Avaliação Média</CardDescription>
              <CardTitle className="text-2xl flex items-center gap-2">
                <Star className="w-5 h-5 text-yellow-500" />
                {seller?.average_rating?.toFixed(1) || "0.0"}
              </CardTitle>
            </CardHeader>
          </Card>

          <Card className="bg-card/50">
            <CardHeader className="pb-2">
              <CardDescription>Pedidos Pendentes</CardDescription>
              <CardTitle className="text-2xl flex items-center gap-2">
                <Clock className="w-5 h-5 text-orange-500" />
                {pendingOrders.length + processingOrders.length}
              </CardTitle>
            </CardHeader>
          </Card>
        </div>

        <Tabs defaultValue="orders" className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="orders">Pedidos</TabsTrigger>
            <TabsTrigger value="settings">Configurações</TabsTrigger>
            <TabsTrigger value="withdrawals">Saques</TabsTrigger>
          </TabsList>

          <TabsContent value="orders" className="space-y-4">
            {orders.length === 0 ? (
              <Card className="bg-card/50">
                <CardContent className="py-12 text-center">
                  <Package className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground">Nenhum pedido ainda</p>
                </CardContent>
              </Card>
            ) : (
              orders.map((order) => (
                <Card key={order.id} className="bg-card/50">
                  <CardContent className="p-6">
                    <div className="flex flex-col md:flex-row justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <p className="font-semibold">
                            {order.amount.toLocaleString()} Robux
                          </p>
                          {getStatusBadge(order.status)}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Comprador: {order.profiles?.username || "N/A"}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Método: {order.delivery_method}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {new Date(order.created_at).toLocaleDateString("pt-BR")}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <p className="font-bold text-primary text-lg">
                          R$ {order.total_price.toFixed(2)}
                        </p>
                        <div className="flex gap-2">
                          {order.status === "pending" && (
                            <Button 
                              size="sm" 
                              onClick={() => handleUpdateOrderStatus(order.id, "processing")}
                            >
                              <RefreshCw className="w-4 h-4 mr-1" />
                              Processar
                            </Button>
                          )}
                          {order.status === "processing" && (
                            <Button 
                              size="sm" 
                              onClick={() => handleUpdateOrderStatus(order.id, "completed")}
                            >
                              <CheckCircle className="w-4 h-4 mr-1" />
                              Concluir
                            </Button>
                          )}
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => navigate(`/order/${order.id}`)}
                          >
                            Ver Detalhes
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          <TabsContent value="settings">
            <Card className="bg-card/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="w-5 h-5" />
                  Configurações de Venda
                </CardTitle>
                <CardDescription>
                  Defina seus preços e disponibilidade
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between p-4 rounded-lg bg-background/50">
                  <div>
                    <Label className="text-base">Status Online</Label>
                    <p className="text-sm text-muted-foreground">
                      Apareça como disponível para vendas
                    </p>
                  </div>
                  <Switch
                    checked={isOnline}
                    onCheckedChange={setIsOnline}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="price">Preço por 1K Robux (R$)</Label>
                    <Input
                      id="price"
                      type="number"
                      step="0.01"
                      value={pricePerK}
                      onChange={(e) => setPricePerK(e.target.value)}
                      className="bg-background/50"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="min">Quantidade Mínima</Label>
                    <Input
                      id="min"
                      type="number"
                      value={minAmount}
                      onChange={(e) => setMinAmount(e.target.value)}
                      className="bg-background/50"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="max">Quantidade Máxima</Label>
                    <Input
                      id="max"
                      type="number"
                      value={maxAmount}
                      onChange={(e) => setMaxAmount(e.target.value)}
                      className="bg-background/50"
                    />
                  </div>
                </div>

                <Button 
                  onClick={handleSaveSettings} 
                  disabled={saving}
                  className="w-full md:w-auto"
                >
                  {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Salvar Alterações
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="withdrawals">
            <Card className="bg-card/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Banknote className="w-5 h-5" />
                  Solicitar Saque
                </CardTitle>
                <CardDescription>
                  Retire seus ganhos para sua conta bancária via PIX
                </CardDescription>
              </CardHeader>
              <CardContent className="text-center py-8">
                <Banknote className="w-12 h-12 mx-auto mb-4 text-primary" />
                <p className="text-2xl font-bold text-primary mb-2">
                  R$ {balance.toFixed(2)}
                </p>
                <p className="text-sm text-muted-foreground mb-6">
                  Saldo disponível para saque
                </p>
                <Button 
                  onClick={() => setShowWithdraw(true)}
                  disabled={balance < 10}
                >
                  <Banknote className="w-4 h-4 mr-2" />
                  Solicitar Saque
                </Button>
                {balance < 10 && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Saldo mínimo para saque: R$ 10,00
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <WithdrawModal
        open={showWithdraw}
        onOpenChange={setShowWithdraw}
        onSuccess={refreshBalance}
        maxAmount={balance}
      />
    </div>
  );
}
