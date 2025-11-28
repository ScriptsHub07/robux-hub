import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AddBalanceModal } from "@/components/AddBalanceModal";
import { 
  Wallet, 
  ShoppingBag, 
  Clock, 
  CheckCircle, 
  XCircle, 
  MessageSquare,
  Plus,
  Store,
  Loader2
} from "lucide-react";
import { Tables } from "@/integrations/supabase/types";

type Order = Tables<"orders"> & {
  sellers: {
    profiles: {
      username: string;
    };
  };
};

type Profile = Tables<"profiles">;

export default function Dashboard() {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [isSeller, setIsSeller] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showAddBalance, setShowAddBalance] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const refreshProfile = async () => {
    if (!user?.id) return;
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();
    if (data) setProfile(data);
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
        fetchUserData(session.user.id);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const fetchUserData = async (userId: string) => {
    try {
      setLoading(true);

      // Fetch profile
      const { data: profileData } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();
      
      setProfile(profileData);

      // Check if seller
      const { data: sellerData } = await supabase
        .from("sellers")
        .select("id")
        .eq("user_id", userId)
        .single();
      
      setIsSeller(!!sellerData);

      // Check if admin
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .eq("role", "admin")
        .single();
      
      setIsAdmin(!!roleData);

      // Fetch orders
      const { data: ordersData } = await supabase
        .from("orders")
        .select(`
          *,
          sellers (
            profiles:user_id (
              username
            )
          )
        `)
        .eq("buyer_id", userId)
        .order("created_at", { ascending: false });

      setOrders((ordersData as Order[]) || []);
    } catch (error: any) {
      console.error("Error fetching user data:", error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; icon: any; label: string }> = {
      pending: { variant: "secondary", icon: Clock, label: "Pendente" },
      processing: { variant: "default", icon: Clock, label: "Processando" },
      completed: { variant: "outline", icon: CheckCircle, label: "Concluído" },
      cancelled: { variant: "destructive", icon: XCircle, label: "Cancelado" },
      disputed: { variant: "destructive", icon: MessageSquare, label: "Disputado" },
    };

    const config = statusConfig[status] || statusConfig.pending;
    const Icon = config.icon;

    return (
      <Badge variant={config.variant} className="gap-1">
        <Icon className="w-3 h-3" />
        {config.label}
      </Badge>
    );
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

  return (
    <div className="min-h-screen bg-background">
      <Navbar user={user} />
      
      <div className="container mx-auto px-4 pt-24 pb-12">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Olá, {profile?.username}!</h1>
          <p className="text-muted-foreground">Gerencie sua conta e acompanhe seus pedidos</p>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card className="bg-gradient-to-br from-primary/20 to-primary/5 border-primary/20">
            <CardHeader className="pb-2">
              <CardDescription>Saldo Disponível</CardDescription>
              <CardTitle className="text-2xl flex items-center gap-2">
                <Wallet className="w-5 h-5 text-primary" />
                R$ {profile?.balance?.toFixed(2) || "0.00"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Button size="sm" className="w-full gap-2" onClick={() => setShowAddBalance(true)}>
                <Plus className="w-4 h-4" />
                Adicionar Saldo
              </Button>
            </CardContent>
          </Card>

          <Card className="bg-card/50">
            <CardHeader className="pb-2">
              <CardDescription>Total de Pedidos</CardDescription>
              <CardTitle className="text-2xl flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-accent" />
                {orders.length}
              </CardTitle>
            </CardHeader>
          </Card>

          {isSeller && (
            <Card className="bg-card/50 cursor-pointer hover:bg-card/70 transition-colors" onClick={() => navigate("/seller")}>
              <CardHeader className="pb-2">
                <CardDescription>Painel do Vendedor</CardDescription>
                <CardTitle className="text-2xl flex items-center gap-2">
                  <Store className="w-5 h-5 text-primary" />
                  Acessar
                </CardTitle>
              </CardHeader>
            </Card>
          )}

          {isAdmin && (
            <Card className="bg-card/50 cursor-pointer hover:bg-card/70 transition-colors" onClick={() => navigate("/admin")}>
              <CardHeader className="pb-2">
                <CardDescription>Painel Admin</CardDescription>
                <CardTitle className="text-2xl flex items-center gap-2">
                  <Store className="w-5 h-5 text-destructive" />
                  Acessar
                </CardTitle>
              </CardHeader>
            </Card>
          )}
        </div>

        {/* Orders Section */}
        <Tabs defaultValue="all" className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="all">Todos</TabsTrigger>
            <TabsTrigger value="pending">Pendentes</TabsTrigger>
            <TabsTrigger value="completed">Concluídos</TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="space-y-4">
            {orders.length === 0 ? (
              <Card className="bg-card/50">
                <CardContent className="py-12 text-center">
                  <ShoppingBag className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground">Você ainda não fez nenhum pedido</p>
                  <Button className="mt-4" onClick={() => navigate("/")}>
                    Ver Vendedores
                  </Button>
                </CardContent>
              </Card>
            ) : (
              orders.map((order) => (
                <Card key={order.id} className="bg-card/50 hover:bg-card/70 transition-colors cursor-pointer" onClick={() => navigate(`/order/${order.id}`)}>
                  <CardContent className="p-6">
                    <div className="flex flex-col md:flex-row justify-between gap-4">
                      <div>
                        <p className="font-semibold mb-1">
                          {order.amount.toLocaleString()} Robux
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Vendedor: {order.sellers?.profiles?.username || "N/A"}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {new Date(order.created_at).toLocaleDateString("pt-BR")}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        {getStatusBadge(order.status)}
                        <p className="font-bold text-primary">
                          R$ {order.total_price.toFixed(2)}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          <TabsContent value="pending" className="space-y-4">
            {orders.filter(o => ["pending", "processing"].includes(o.status)).map((order) => (
              <Card key={order.id} className="bg-card/50 hover:bg-card/70 transition-colors cursor-pointer" onClick={() => navigate(`/order/${order.id}`)}>
                <CardContent className="p-6">
                  <div className="flex flex-col md:flex-row justify-between gap-4">
                    <div>
                      <p className="font-semibold mb-1">
                        {order.amount.toLocaleString()} Robux
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Vendedor: {order.sellers?.profiles?.username || "N/A"}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      {getStatusBadge(order.status)}
                      <p className="font-bold text-primary">
                        R$ {order.total_price.toFixed(2)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="completed" className="space-y-4">
            {orders.filter(o => o.status === "completed").map((order) => (
              <Card key={order.id} className="bg-card/50 hover:bg-card/70 transition-colors cursor-pointer" onClick={() => navigate(`/order/${order.id}`)}>
                <CardContent className="p-6">
                  <div className="flex flex-col md:flex-row justify-between gap-4">
                    <div>
                      <p className="font-semibold mb-1">
                        {order.amount.toLocaleString()} Robux
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Vendedor: {order.sellers?.profiles?.username || "N/A"}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      {getStatusBadge(order.status)}
                      <p className="font-bold text-primary">
                        R$ {order.total_price.toFixed(2)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>
        </Tabs>
      </div>

      <AddBalanceModal 
        open={showAddBalance} 
        onOpenChange={setShowAddBalance}
        onSuccess={refreshProfile}
      />
    </div>
  );
}
