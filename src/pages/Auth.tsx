import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { z } from "zod";

const authSchema = z.object({
  email: z.string().trim().email({ message: "Email inválido" }).max(255),
  password: z.string().min(6, { message: "Senha deve ter no mínimo 6 caracteres" }).max(100),
  username: z.string().trim().min(3, { message: "Username deve ter no mínimo 3 caracteres" }).max(50).optional(),
});

export default function Auth() {
  const [searchParams] = useSearchParams();
  const [isLogin, setIsLogin] = useState(searchParams.get("mode") !== "signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        navigate("/");
      }
    };
    checkUser();
  }, [navigate]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const data = authSchema.parse({
        email,
        password,
        username: isLogin ? undefined : username,
      });

      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({
          email: data.email,
          password: data.password,
        });

        if (error) throw error;

        toast({
          title: "Login realizado!",
          description: "Bem-vindo de volta",
        });
        navigate("/");
      } else {
        const { error } = await supabase.auth.signUp({
          email: data.email,
          password: data.password,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
            data: {
              username: data.username,
            },
          },
        });

        if (error) throw error;

        toast({
          title: "Conta criada!",
          description: "Você já pode fazer login",
        });
        setIsLogin(true);
      }
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        toast({
          title: "Erro de validação",
          description: error.errors[0].message,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Erro",
          description: error.message || "Ocorreu um erro. Tente novamente.",
          variant: "destructive",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background via-background to-secondary/20 relative overflow-hidden">
      {/* Background effects */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-[100px]" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-accent/10 rounded-full blur-[100px]" />

      <Card className="w-full max-w-md bg-card/50 backdrop-blur-sm border-border shadow-purple relative z-10 animate-scale-in">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">
            {isLogin ? "Entrar na sua conta" : "Criar uma conta"}
          </CardTitle>
          <CardDescription className="text-center">
            {isLogin
              ? "Entre com seu email e senha para continuar"
              : "Preencha os dados abaixo para criar sua conta"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAuth} className="space-y-4">
            {!isLogin && (
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  type="text"
                  placeholder="seu_username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required={!isLogin}
                  disabled={loading}
                  className="bg-background/50"
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
                className="bg-background/50"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
                className="bg-background/50"
              />
            </div>

            <Button
              type="submit"
              className="w-full bg-gradient-to-r from-primary to-accent hover:opacity-90 transition-opacity"
              disabled={loading}
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isLogin ? "Entrar" : "Criar conta"}
            </Button>
          </form>

          <div className="mt-4 text-center text-sm">
            <button
              onClick={() => setIsLogin(!isLogin)}
              className="text-primary hover:underline"
              disabled={loading}
            >
              {isLogin ? "Não tem uma conta? Cadastre-se" : "Já tem uma conta? Entre"}
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}