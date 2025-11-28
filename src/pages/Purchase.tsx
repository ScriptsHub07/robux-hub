import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  Star, 
  ShieldCheck, 
  Gamepad2,
  Gift,
  Users,
  Loader2,
  ArrowLeft,
  Calculator
} from "lucide-react";
import { Tables } from "@/integrations/supabase/types";

type Seller = Tables<"sellers"> & {
  profiles: {
    username: string;
    avatar_url: string | null;
  };
};

type Profile = Tables<"profiles">;

export default function Purchase() {
  const { sellerId } = useParams();
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [seller, setSeller] = useState<Seller | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [amount, setAmount] = useState("");
  const [deliveryMethod, setDeliveryMethod] = useState<"gamepass" | "donation" | "group_payout">("gamepass");
  const navigate = useNavigate();
  const { toast } = useToast();

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
        fetchData(session.user.id);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate, sellerId]);

  const fetchData = async (userId: string) => {
    try {
      setLoading(true);

      // Fetch profile
      const { data: profileData } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();
      
      setProfile(profileData);

      // Fetch seller
      const { data: sellerData, error } = await supabase
        .from("sellers")
        .select(`
          *,
          profiles:user_id (
            username,
            avatar_url
          )
        `)
        .eq("id", sellerId)
        .single();

      if (error || !sellerData) {
        toast({
          title: "Vendedor não encontrado",
          variant: "destructive",
        });
        navigate("/");
        return;
      }

      setSeller(sellerData as Seller);
    } catch (error: any) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  const calculateTotal = () => {
    if (!seller || !amount) return 0;
    const robuxAmount = parseInt(amount);
    return (robuxAmount / 1000) * Number(seller.price_per_1k);
  };

  const handlePurchase = async () => {
    if (!seller || !user || !profile) return;

    const robuxAmount = parseInt(amount);
    
    if (isNaN(robuxAmount) || robuxAmount < seller.min_amount || robuxAmount > seller.max_amount) {
      toast({
        title: "Quantidade inválida",
        description: `A quantidade deve estar entre ${seller.min_amount.toLocaleString()} e ${seller.max_amount.toLocaleString()} Robux`,
        variant: "destructive",
      });
      return;
    }

    const totalPrice = calculateTotal();

    if (Number(profile.balance) < totalPrice) {
      toast({
        title: "Saldo insuficiente",
        description: `Você precisa de R$ ${totalPrice.toFixed(2)} mas tem apenas R$ ${Number(profile.balance).toFixed(2)}`,
        variant: "destructive",
      });
      return;
    }

    try {
      setSubmitting(true);

      // Create order
      const { data: order, error: orderError } = await supabase
        .from("orders")
        .insert({
          buyer_id: user.id,
          seller_id: seller.id,
          amount: robuxAmount,
          total_price: totalPrice,
          delivery_method: deliveryMethod,
        })
        .select()
        .single();

      if (orderError) throw orderError;

      // Deduct balance
      const { error: balanceError } = await supabase
        .from("profiles")
        .update({ balance: Number(profile.balance) - totalPrice })
        .eq("id", user.id);

      if (balanceError) throw balanceError;

      // Create transaction record
      await supabase.from("transactions").insert({
        user_id: user.id,
        order_id: order.id,
        type: "purchase",
        amount: -totalPrice,
        description: `Compra de ${robuxAmount.toLocaleString()} Robux`,
      });

      toast({
        title: "Pedido criado!",
        description: "Aguarde o vendedor processar seu pedido",
      });

      navigate(`/order/${order.id}`);
    } catch (error: any) {
      toast({
        title: "Erro ao criar pedido",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
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

  if (!seller) return null;

  const totalPrice = calculateTotal();
  const isValidAmount = amount && parseInt(amount) >= seller.min_amount && parseInt(amount) <= seller.max_amount;
  const hasEnoughBalance = profile && Number(profile.balance) >= totalPrice;

  return (
    <div className="min-h-screen bg-background">
      <Navbar user={user} />
      
      <div className="container mx-auto px-4 pt-24 pb-12">
        <Button 
          variant="ghost" 
          className="mb-6"
          onClick={() => navigate("/")}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Voltar aos Vendedores
        </Button>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Seller Info */}
          <Card className="bg-card/50 lg:col-span-1">
            <CardHeader>
              <div className="flex items-center gap-4">
                <Avatar className="w-16 h-16">
                  <AvatarImage src={seller.profiles?.avatar_url || undefined} />
                  <AvatarFallback className="bg-primary/20 text-primary text-xl">
                    {seller.profiles?.username?.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <CardTitle className="flex items-center gap-2">
                    {seller.profiles?.username}
                    {seller.is_online && (
                      <Badge variant="outline" className="bg-green-500/20 text-green-500 border-green-500/30">
                        Online
                      </Badge>
                    )}
                  </CardTitle>
                  <CardDescription className="flex items-center gap-1 mt-1">
                    <Star className="w-4 h-4 fill-yellow-500 text-yellow-500" />
                    {Number(seller.average_rating).toFixed(1)} ({seller.total_ratings} avaliações)
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center p-3 rounded-lg bg-background/50">
                <span className="text-muted-foreground">Preço por 1K</span>
                <span className="font-bold text-primary">R$ {Number(seller.price_per_1k).toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center p-3 rounded-lg bg-background/50">
                <span className="text-muted-foreground">Mínimo</span>
                <span className="font-semibold">{seller.min_amount.toLocaleString()} R$</span>
              </div>
              <div className="flex justify-between items-center p-3 rounded-lg bg-background/50">
                <span className="text-muted-foreground">Máximo</span>
                <span className="font-semibold">{seller.max_amount.toLocaleString()} R$</span>
              </div>
              <div className="flex justify-between items-center p-3 rounded-lg bg-background/50">
                <span className="text-muted-foreground">Vendas</span>
                <span className="font-semibold flex items-center gap-1">
                  <ShieldCheck className="w-4 h-4 text-green-500" />
                  {seller.total_sales}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Purchase Form */}
          <Card className="bg-card/50 lg:col-span-2">
            <CardHeader>
              <CardTitle>Comprar Robux</CardTitle>
              <CardDescription>
                Escolha a quantidade e método de entrega
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Amount Input */}
              <div className="space-y-2">
                <Label htmlFor="amount">Quantidade de Robux</Label>
                <div className="relative">
                  <Calculator className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                  <Input
                    id="amount"
                    type="number"
                    placeholder={`${seller.min_amount.toLocaleString()} - ${seller.max_amount.toLocaleString()}`}
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="pl-10 bg-background/50"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Mínimo: {seller.min_amount.toLocaleString()} | Máximo: {seller.max_amount.toLocaleString()}
                </p>
              </div>

              {/* Delivery Method */}
              <div className="space-y-3">
                <Label>Método de Entrega</Label>
                <RadioGroup
                  value={deliveryMethod}
                  onValueChange={(v) => setDeliveryMethod(v as any)}
                  className="grid grid-cols-1 md:grid-cols-3 gap-4"
                >
                  <div className="relative">
                    <RadioGroupItem value="gamepass" id="gamepass" className="peer sr-only" />
                    <Label
                      htmlFor="gamepass"
                      className="flex flex-col items-center justify-center p-4 rounded-lg border-2 border-border bg-background/50 cursor-pointer hover:border-primary/50 peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/10 transition-colors"
                    >
                      <Gamepad2 className="w-8 h-8 mb-2 text-primary" />
                      <span className="font-medium">Gamepass</span>
                      <span className="text-xs text-muted-foreground">Via gamepass</span>
                    </Label>
                  </div>

                  <div className="relative">
                    <RadioGroupItem value="donation" id="donation" className="peer sr-only" />
                    <Label
                      htmlFor="donation"
                      className="flex flex-col items-center justify-center p-4 rounded-lg border-2 border-border bg-background/50 cursor-pointer hover:border-primary/50 peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/10 transition-colors"
                    >
                      <Gift className="w-8 h-8 mb-2 text-accent" />
                      <span className="font-medium">Doação</span>
                      <span className="text-xs text-muted-foreground">PLS Donate</span>
                    </Label>
                  </div>

                  <div className="relative">
                    <RadioGroupItem value="group_payout" id="group_payout" className="peer sr-only" />
                    <Label
                      htmlFor="group_payout"
                      className="flex flex-col items-center justify-center p-4 rounded-lg border-2 border-border bg-background/50 cursor-pointer hover:border-primary/50 peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/10 transition-colors"
                    >
                      <Users className="w-8 h-8 mb-2 text-green-500" />
                      <span className="font-medium">Group Payout</span>
                      <span className="text-xs text-muted-foreground">Via grupo</span>
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              {/* Summary */}
              <Card className="bg-gradient-to-br from-primary/10 to-accent/10 border-primary/20">
                <CardContent className="p-6">
                  <div className="flex justify-between items-center mb-4">
                    <span className="text-muted-foreground">Seu saldo</span>
                    <span className={`font-semibold ${!hasEnoughBalance && amount ? 'text-destructive' : ''}`}>
                      R$ {Number(profile?.balance || 0).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center mb-4">
                    <span className="text-muted-foreground">Quantidade</span>
                    <span className="font-semibold">
                      {amount ? parseInt(amount).toLocaleString() : 0} Robux
                    </span>
                  </div>
                  <div className="border-t border-border pt-4">
                    <div className="flex justify-between items-center">
                      <span className="text-lg font-semibold">Total</span>
                      <span className="text-2xl font-bold text-primary">
                        R$ {totalPrice.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Submit Button */}
              <Button
                className="w-full bg-gradient-to-r from-primary to-accent hover:opacity-90 transition-opacity"
                size="lg"
                disabled={!isValidAmount || !hasEnoughBalance || submitting}
                onClick={handlePurchase}
              >
                {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {!hasEnoughBalance && amount ? "Saldo Insuficiente" : "Confirmar Compra"}
              </Button>

              {!hasEnoughBalance && amount && (
                <p className="text-center text-sm text-destructive">
                  Adicione saldo para continuar com a compra
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
