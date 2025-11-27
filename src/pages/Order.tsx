import { useState, useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { 
  Clock, 
  CheckCircle, 
  XCircle, 
  MessageSquare,
  Send,
  ArrowLeft,
  Star,
  Loader2,
  AlertTriangle
} from "lucide-react";
import { Tables } from "@/integrations/supabase/types";

type Order = Tables<"orders"> & {
  sellers: {
    user_id: string;
    profiles: {
      username: string;
      avatar_url: string | null;
    };
  };
  profiles: {
    username: string;
  };
};

type ChatMessage = Tables<"chat_messages"> & {
  profiles: {
    username: string;
    avatar_url: string | null;
  };
};

export default function OrderPage() {
  const { orderId } = useParams();
  const [user, setUser] = useState<any>(null);
  const [order, setOrder] = useState<Order | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState("");
  const [hasRated, setHasRated] = useState(false);
  const [submittingRating, setSubmittingRating] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
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
        fetchOrderData();
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate, orderId]);

  useEffect(() => {
    if (!orderId) return;

    // Subscribe to new messages
    const channel = supabase
      .channel(`order-${orderId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `order_id=eq.${orderId}`,
        },
        async (payload) => {
          // Fetch the full message with profile
          const { data } = await supabase
            .from("chat_messages")
            .select(`
              *,
              profiles:sender_id (
                username,
                avatar_url
              )
            `)
            .eq("id", payload.new.id)
            .single();
          
          if (data) {
            setMessages((prev) => [...prev, data as ChatMessage]);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [orderId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const fetchOrderData = async () => {
    try {
      setLoading(true);

      // Fetch order
      const { data: orderData, error } = await supabase
        .from("orders")
        .select(`
          *,
          sellers (
            user_id,
            profiles:user_id (
              username,
              avatar_url
            )
          ),
          profiles:buyer_id (
            username
          )
        `)
        .eq("id", orderId)
        .single();

      if (error || !orderData) {
        toast({
          title: "Pedido não encontrado",
          variant: "destructive",
        });
        navigate("/dashboard");
        return;
      }

      setOrder(orderData as Order);

      // Fetch messages
      const { data: messagesData } = await supabase
        .from("chat_messages")
        .select(`
          *,
          profiles:sender_id (
            username,
            avatar_url
          )
        `)
        .eq("order_id", orderId)
        .order("created_at", { ascending: true });

      setMessages((messagesData as ChatMessage[]) || []);

      // Check if user has rated
      const { data: ratingData } = await supabase
        .from("ratings")
        .select("id")
        .eq("order_id", orderId)
        .single();

      setHasRated(!!ratingData);
    } catch (error: any) {
      console.error("Error fetching order:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !user || !orderId) return;

    try {
      setSending(true);

      const { error } = await supabase
        .from("chat_messages")
        .insert({
          order_id: orderId,
          sender_id: user.id,
          message: newMessage.trim(),
        });

      if (error) throw error;

      setNewMessage("");
    } catch (error: any) {
      toast({
        title: "Erro ao enviar mensagem",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  const handleSubmitRating = async () => {
    if (!order || !user || rating === 0) return;

    try {
      setSubmittingRating(true);

      const { error } = await supabase
        .from("ratings")
        .insert({
          order_id: order.id,
          buyer_id: user.id,
          seller_id: order.seller_id,
          rating,
          comment: comment.trim() || null,
        });

      if (error) throw error;

      setHasRated(true);
      toast({
        title: "Avaliação enviada!",
        description: "Obrigado pelo seu feedback",
      });
    } catch (error: any) {
      toast({
        title: "Erro ao avaliar",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSubmittingRating(false);
    }
  };

  const getStatusInfo = (status: string) => {
    const statusConfig: Record<string, { icon: any; color: string; label: string; description: string }> = {
      pending: { 
        icon: Clock, 
        color: "text-yellow-500", 
        label: "Pendente",
        description: "Aguardando o vendedor iniciar o processamento"
      },
      processing: { 
        icon: Clock, 
        color: "text-blue-500", 
        label: "Processando",
        description: "O vendedor está preparando sua entrega"
      },
      completed: { 
        icon: CheckCircle, 
        color: "text-green-500", 
        label: "Concluído",
        description: "Pedido entregue com sucesso!"
      },
      cancelled: { 
        icon: XCircle, 
        color: "text-destructive", 
        label: "Cancelado",
        description: "Este pedido foi cancelado"
      },
      disputed: { 
        icon: AlertTriangle, 
        color: "text-orange-500", 
        label: "Disputado",
        description: "Este pedido está em disputa"
      },
    };

    return statusConfig[status] || statusConfig.pending;
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

  if (!order) return null;

  const statusInfo = getStatusInfo(order.status);
  const StatusIcon = statusInfo.icon;
  const isBuyer = user?.id === order.buyer_id;
  const canRate = isBuyer && order.status === "completed" && !hasRated;

  return (
    <div className="min-h-screen bg-background">
      <Navbar user={user} />
      
      <div className="container mx-auto px-4 pt-24 pb-12">
        <Button 
          variant="ghost" 
          className="mb-6"
          onClick={() => navigate("/dashboard")}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Voltar ao Dashboard
        </Button>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Order Details */}
          <div className="lg:col-span-1 space-y-6">
            <Card className="bg-card/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <StatusIcon className={`w-5 h-5 ${statusInfo.color}`} />
                  {statusInfo.label}
                </CardTitle>
                <CardDescription>{statusInfo.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center p-3 rounded-lg bg-background/50">
                  <span className="text-muted-foreground">Quantidade</span>
                  <span className="font-bold">{order.amount.toLocaleString()} Robux</span>
                </div>
                <div className="flex justify-between items-center p-3 rounded-lg bg-background/50">
                  <span className="text-muted-foreground">Valor Pago</span>
                  <span className="font-bold text-primary">R$ {Number(order.total_price).toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center p-3 rounded-lg bg-background/50">
                  <span className="text-muted-foreground">Método</span>
                  <Badge variant="outline">{order.delivery_method}</Badge>
                </div>
                <div className="flex justify-between items-center p-3 rounded-lg bg-background/50">
                  <span className="text-muted-foreground">Data</span>
                  <span className="font-medium">
                    {new Date(order.created_at).toLocaleDateString("pt-BR")}
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Seller Info */}
            <Card className="bg-card/50">
              <CardHeader>
                <CardTitle className="text-sm text-muted-foreground">Vendedor</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-3">
                  <Avatar>
                    <AvatarImage src={order.sellers?.profiles?.avatar_url || undefined} />
                    <AvatarFallback className="bg-primary/20 text-primary">
                      {order.sellers?.profiles?.username?.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="font-medium">{order.sellers?.profiles?.username}</span>
                </div>
              </CardContent>
            </Card>

            {/* Rating Card */}
            {canRate && (
              <Card className="bg-gradient-to-br from-primary/10 to-accent/10 border-primary/20">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Star className="w-5 h-5 text-yellow-500" />
                    Avaliar Vendedor
                  </CardTitle>
                  <CardDescription>
                    Como foi sua experiência?
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-center gap-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onMouseEnter={() => setHoverRating(star)}
                        onMouseLeave={() => setHoverRating(0)}
                        onClick={() => setRating(star)}
                        className="transition-transform hover:scale-110"
                      >
                        <Star
                          className={`w-8 h-8 ${
                            star <= (hoverRating || rating)
                              ? "fill-yellow-500 text-yellow-500"
                              : "text-muted-foreground"
                          }`}
                        />
                      </button>
                    ))}
                  </div>
                  <Textarea
                    placeholder="Deixe um comentário (opcional)"
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    className="bg-background/50"
                  />
                  <Button
                    className="w-full"
                    disabled={rating === 0 || submittingRating}
                    onClick={handleSubmitRating}
                  >
                    {submittingRating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    Enviar Avaliação
                  </Button>
                </CardContent>
              </Card>
            )}

            {hasRated && (
              <Card className="bg-card/50">
                <CardContent className="py-6 text-center">
                  <CheckCircle className="w-8 h-8 mx-auto mb-2 text-green-500" />
                  <p className="text-muted-foreground">Você já avaliou este pedido</p>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Chat Section */}
          <Card className="bg-card/50 lg:col-span-2 flex flex-col h-[600px]">
            <CardHeader className="border-b border-border">
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5" />
                Chat do Pedido
              </CardTitle>
            </CardHeader>
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-4">
                {messages.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>Nenhuma mensagem ainda</p>
                    <p className="text-sm">Inicie uma conversa com o vendedor</p>
                  </div>
                ) : (
                  messages.map((message) => {
                    const isOwn = message.sender_id === user?.id;
                    return (
                      <div
                        key={message.id}
                        className={`flex gap-3 ${isOwn ? "flex-row-reverse" : ""}`}
                      >
                        <Avatar className="w-8 h-8">
                          <AvatarImage src={message.profiles?.avatar_url || undefined} />
                          <AvatarFallback className="bg-primary/20 text-primary text-xs">
                            {message.profiles?.username?.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div
                          className={`max-w-[70%] p-3 rounded-lg ${
                            isOwn
                              ? "bg-primary text-primary-foreground"
                              : "bg-background"
                          }`}
                        >
                          <p className="text-xs font-medium mb-1 opacity-70">
                            {message.profiles?.username}
                          </p>
                          <p className="text-sm">{message.message}</p>
                          <p className="text-xs opacity-50 mt-1">
                            {new Date(message.created_at).toLocaleTimeString("pt-BR", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </p>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>
            <div className="p-4 border-t border-border">
              <div className="flex gap-2">
                <Input
                  placeholder="Digite sua mensagem..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSendMessage()}
                  className="bg-background/50"
                  disabled={sending}
                />
                <Button 
                  onClick={handleSendMessage} 
                  disabled={!newMessage.trim() || sending}
                >
                  {sending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
