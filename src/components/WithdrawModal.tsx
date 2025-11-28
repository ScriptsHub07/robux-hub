import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

interface WithdrawModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  maxAmount: number;
}

type PixKeyType = "CPF" | "CNPJ" | "EMAIL" | "PHONE" | "EVP";

export function WithdrawModal({ open, onOpenChange, onSuccess, maxAmount }: WithdrawModalProps) {
  const [amount, setAmount] = useState("");
  const [pixKey, setPixKey] = useState("");
  const [pixKeyType, setPixKeyType] = useState<PixKeyType>("CPF");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleWithdraw = async () => {
    const value = parseFloat(amount);
    if (isNaN(value) || value < 10) {
      toast({
        title: "Valor inválido",
        description: "O valor mínimo para saque é R$ 10,00",
        variant: "destructive",
      });
      return;
    }

    if (value > maxAmount) {
      toast({
        title: "Saldo insuficiente",
        description: `Seu saldo disponível é R$ ${maxAmount.toFixed(2)}`,
        variant: "destructive",
      });
      return;
    }

    if (!pixKey.trim()) {
      toast({
        title: "Chave PIX obrigatória",
        description: "Informe sua chave PIX para receber o saque",
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);
      
      const response = await supabase.functions.invoke("asaas-create-withdrawal", {
        body: { amount: value, pixKey, pixKeyType },
      });

      if (response.error) {
        throw new Error(response.error.message || "Erro ao solicitar saque");
      }

      toast({
        title: "Saque solicitado!",
        description: "Sua solicitação de saque foi criada com sucesso",
      });
      
      onSuccess();
      handleClose();
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setAmount("");
    setPixKey("");
    setPixKeyType("CPF");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Solicitar Saque</DialogTitle>
          <DialogDescription>
            Saldo disponível: R$ {maxAmount.toFixed(2)}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="withdraw-amount">Valor (R$)</Label>
            <Input
              id="withdraw-amount"
              type="number"
              min="10"
              max={maxAmount}
              step="0.01"
              placeholder="Mínimo R$ 10,00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="pix-key-type">Tipo de Chave PIX</Label>
            <Select value={pixKeyType} onValueChange={(v) => setPixKeyType(v as PixKeyType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="CPF">CPF</SelectItem>
                <SelectItem value="CNPJ">CNPJ</SelectItem>
                <SelectItem value="EMAIL">E-mail</SelectItem>
                <SelectItem value="PHONE">Telefone</SelectItem>
                <SelectItem value="EVP">Chave Aleatória</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="pix-key">Chave PIX</Label>
            <Input
              id="pix-key"
              type="text"
              placeholder={
                pixKeyType === "CPF" ? "000.000.000-00" :
                pixKeyType === "CNPJ" ? "00.000.000/0000-00" :
                pixKeyType === "EMAIL" ? "seu@email.com" :
                pixKeyType === "PHONE" ? "+5511999999999" :
                "Chave aleatória"
              }
              value={pixKey}
              onChange={(e) => setPixKey(e.target.value)}
            />
          </div>

          <Button
            className="w-full"
            onClick={handleWithdraw}
            disabled={loading}
          >
            {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Solicitar Saque
          </Button>

          {amount && parseFloat(amount) >= 10 && (
            <div className="p-3 bg-muted rounded-lg text-sm space-y-1">
              <div className="flex justify-between">
                <span>Valor solicitado:</span>
                <span>R$ {parseFloat(amount).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-destructive">
                <span>Taxa (5%):</span>
                <span>- R$ {(parseFloat(amount) * 0.05).toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-semibold border-t pt-1">
                <span>Você receberá:</span>
                <span>R$ {(parseFloat(amount) * 0.95).toFixed(2)}</span>
              </div>
            </div>
          )}

          <p className="text-xs text-center text-muted-foreground">
            O saque será processado em até 24 horas úteis
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
