import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Star, ShoppingCart, TrendingUp, Clock } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface SellerCardProps {
  seller: {
    id: string;
    username: string;
    avatar_url?: string;
    price_per_1k: number;
    min_amount: number;
    max_amount: number;
    is_online: boolean;
    average_rating: number;
    total_ratings: number;
    total_sales: number;
  };
  onBuy: (sellerId: string) => void;
}

export const SellerCard = ({ seller, onBuy }: SellerCardProps) => {
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(price);
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + "M";
    }
    if (num >= 1000) {
      return (num / 1000).toFixed(1) + "K";
    }
    return num.toString();
  };

  return (
    <Card className="p-6 bg-card/50 backdrop-blur-sm border-border hover:border-primary/50 transition-all hover:shadow-purple group">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <Avatar className="w-12 h-12 border-2 border-primary/20">
            <AvatarImage src={seller.avatar_url} />
            <AvatarFallback className="bg-primary/10 text-primary">
              {seller.username.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold">{seller.username}</h3>
              {seller.is_online && (
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                  <span className="text-xs text-green-500">Online</span>
                </div>
              )}
            </div>
            <div className="flex items-center gap-1 mt-1">
              <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
              <span className="text-sm font-medium">{seller.average_rating.toFixed(1)}</span>
              <span className="text-xs text-muted-foreground">
                ({seller.total_ratings} avaliações)
              </span>
            </div>
          </div>
        </div>
        
        {!seller.is_online && (
          <Badge variant="secondary" className="gap-1">
            <Clock className="w-3 h-3" />
            Offline
          </Badge>
        )}
      </div>

      <div className="space-y-3 mb-4">
        <div className="flex items-center justify-between p-3 bg-background/50 rounded-lg border border-border">
          <div>
            <p className="text-xs text-muted-foreground mb-1">Preço por 1K</p>
            <p className="text-2xl font-bold text-primary">{formatPrice(seller.price_per_1k)}</p>
          </div>
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
            <TrendingUp className="w-6 h-6 text-primary" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 bg-background/50 rounded-lg border border-border">
            <p className="text-xs text-muted-foreground mb-1">Mínimo</p>
            <p className="font-semibold">{formatNumber(seller.min_amount)}</p>
          </div>
          <div className="p-3 bg-background/50 rounded-lg border border-border">
            <p className="text-xs text-muted-foreground mb-1">Máximo</p>
            <p className="font-semibold">{formatNumber(seller.max_amount)}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <ShoppingCart className="w-4 h-4" />
          <span>{formatNumber(seller.total_sales)} vendas realizadas</span>
        </div>
      </div>

      <Button
        onClick={() => onBuy(seller.id)}
        disabled={!seller.is_online}
        className="w-full bg-gradient-to-r from-primary to-accent hover:opacity-90 transition-opacity"
      >
        Comprar Agora
      </Button>
    </Card>
  );
};