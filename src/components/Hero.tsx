import { Button } from "@/components/ui/button";
import { ArrowRight, Shield, Zap, Star } from "lucide-react";

export const Hero = () => {
  const scrollToSellers = () => {
    const sellersSection = document.getElementById("sellers");
    sellersSection?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Animated background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-background via-background to-secondary/20" />
      
      {/* Glowing orbs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-[100px] animate-glow" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-accent/20 rounded-full blur-[100px] animate-glow" style={{ animationDelay: "1s" }} />

      <div className="container mx-auto px-4 relative z-10">
        <div className="max-w-4xl mx-auto text-center space-y-8 animate-fade-in">
          <div className="inline-flex items-center gap-2 bg-muted/50 backdrop-blur-sm px-4 py-2 rounded-full border border-border mb-4">
            <Shield className="w-4 h-4 text-primary" />
            <span className="text-sm">Marketplace 100% Seguro</span>
          </div>

          <h1 className="text-5xl md:text-7xl font-bold bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent leading-tight">
            Compre Robux com
            <br />
            os Melhores Preços
          </h1>

          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Marketplace confiável com vendedores verificados. Transações rápidas, seguras e com os melhores preços do mercado.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Button
              size="lg"
              onClick={scrollToSellers}
              className="bg-gradient-to-r from-primary to-accent hover:opacity-90 transition-opacity shadow-purple group"
            >
              Ver Vendedores
              <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="border-border hover:bg-muted/50"
            >
              Como Funciona
            </Button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pt-16">
            <div className="flex flex-col items-center gap-2 p-6 rounded-xl bg-card/50 backdrop-blur-sm border border-border hover:border-primary/50 transition-colors">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-2">
                <Zap className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-3xl font-bold">2min</h3>
              <p className="text-sm text-muted-foreground">Entrega Média</p>
            </div>

            <div className="flex flex-col items-center gap-2 p-6 rounded-xl bg-card/50 backdrop-blur-sm border border-border hover:border-primary/50 transition-colors">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-2">
                <Shield className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-3xl font-bold">100%</h3>
              <p className="text-sm text-muted-foreground">Transações Seguras</p>
            </div>

            <div className="flex flex-col items-center gap-2 p-6 rounded-xl bg-card/50 backdrop-blur-sm border border-border hover:border-primary/50 transition-colors">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-2">
                <Star className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-3xl font-bold">4.9</h3>
              <p className="text-sm text-muted-foreground">Avaliação Média</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};