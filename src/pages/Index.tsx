import { useState, useEffect } from "react";
import { Hero } from "@/components/Hero";
import { Navbar } from "@/components/Navbar";
import { SellerCard } from "@/components/SellerCard";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Search, SlidersHorizontal } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Seller {
  id: string;
  user_id: string;
  price_per_1k: number;
  min_amount: number;
  max_amount: number;
  is_online: boolean;
  average_rating: number;
  total_ratings: number;
  total_sales: number;
  profiles: {
    username: string;
    avatar_url: string | null;
  };
}

const Index = () => {
  const [user, setUser] = useState<any>(null);
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState("price");
  const { toast } = useToast();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setUser(session?.user ?? null);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    fetchSellers();
  }, []);

  const fetchSellers = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("sellers")
        .select(`
          *,
          profiles:user_id (
            username,
            avatar_url
          )
        `)
        .order("price_per_1k", { ascending: true });

      if (error) throw error;
      setSellers(data || []);
    } catch (error: any) {
      toast({
        title: "Erro ao carregar vendedores",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleBuy = (sellerId: string) => {
    if (!user) {
      toast({
        title: "Faça login",
        description: "Você precisa estar logado para comprar Robux",
        variant: "destructive",
      });
      return;
    }
    // TODO: Navigate to purchase flow
    toast({
      title: "Em breve",
      description: "Sistema de compra será implementado em breve",
    });
  };

  const filteredSellers = sellers
    .filter((seller) =>
      seller.profiles?.username.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a, b) => {
      if (sortBy === "price") return a.price_per_1k - b.price_per_1k;
      if (sortBy === "rating") return b.average_rating - a.average_rating;
      if (sortBy === "sales") return b.total_sales - a.total_sales;
      return 0;
    });

  return (
    <div className="min-h-screen bg-background">
      <Navbar user={user} />
      
      <Hero />

      {/* Sellers Section */}
      <section id="sellers" className="py-20 px-4">
        <div className="container mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold mb-4">
              Vendedores Disponíveis
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Escolha entre os melhores vendedores verificados e faça sua compra com segurança
            </p>
          </div>

          {/* Filters */}
          <div className="flex flex-col md:flex-row gap-4 mb-8 max-w-4xl mx-auto">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="Buscar vendedor..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 bg-card/50 border-border"
              />
            </div>
            
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-full md:w-48 bg-card/50 border-border">
                <SlidersHorizontal className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Ordenar por" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="price">Menor Preço</SelectItem>
                <SelectItem value="rating">Melhor Avaliação</SelectItem>
                <SelectItem value="sales">Mais Vendas</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Sellers Grid */}
          {loading ? (
            <div className="flex justify-center items-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : filteredSellers.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-muted-foreground">Nenhum vendedor encontrado</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredSellers.map((seller) => (
                <SellerCard
                  key={seller.id}
                  seller={{
                    id: seller.id,
                    username: seller.profiles?.username || "Vendedor",
                    avatar_url: seller.profiles?.avatar_url || undefined,
                    price_per_1k: seller.price_per_1k,
                    min_amount: seller.min_amount,
                    max_amount: seller.max_amount,
                    is_online: seller.is_online,
                    average_rating: seller.average_rating,
                    total_ratings: seller.total_ratings,
                    total_sales: seller.total_sales,
                  }}
                  onBuy={handleBuy}
                />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8 px-4">
        <div className="container mx-auto text-center text-muted-foreground">
          <p>© 2024 RobuxMarket. Marketplace seguro de Robux.</p>
        </div>
      </footer>
    </div>
  );
};

export default Index;