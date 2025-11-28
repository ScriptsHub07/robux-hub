import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, QrCode, Copy, CheckCircle2 } from "lucide-react";

interface AddBalanceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function AddBalanceModal({ open, onOpenChange, onSuccess }: AddBalanceModalProps) {
  const [amount, setAmount] = useState("");
  const [billingType, setBillingType] = useState<"PIX" | "BOLETO">("PIX");
  const [loading, setLoading] = useState(false);
  const [paymentData, setPaymentData] = useState<{
    paymentId: string;
    pixQrCode?: string;
    pixCopyPaste?: string;
    invoiceUrl?: string;
    bankSlipUrl?: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);
  const [checkingPayment, setCheckingPayment] = useState(false);
  const { toast } = useToast();

  const handleCreatePayment = async () => {
    const value = parseFloat(amount);
    if (isNaN(value) || value < 5) {
      toast({
        title: "Valor inválido",
        description: "O valor mínimo é R$ 5,00",
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await supabase.functions.invoke("asaas-create-payment", {
        body: { amount: value, billingType },
      });

      if (response.error) {
        throw new Error(response.error.message || "Erro ao criar pagamento");
      }

      setPaymentData(response.data);
      toast({
        title: "Pagamento criado!",
        description: billingType === "PIX" ? "Escaneie o QR Code ou copie o código PIX" : "Clique no link para visualizar o boleto",
      });
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

  const handleCopyPix = async () => {
    if (paymentData?.pixCopyPaste) {
      await navigator.clipboard.writeText(paymentData.pixCopyPaste);
      setCopied(true);
      toast({ title: "Código PIX copiado!" });
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleCheckPayment = async () => {
    if (!paymentData?.paymentId) return;

    try {
      setCheckingPayment(true);
      const response = await supabase.functions.invoke("asaas-check-payment", {
        body: { paymentId: paymentData.paymentId },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      if (response.data.status === "CONFIRMED" || response.data.status === "RECEIVED") {
        toast({
          title: "Pagamento confirmado!",
          description: `R$ ${response.data.value.toFixed(2)} adicionados ao seu saldo`,
        });
        onSuccess();
        handleClose();
      } else {
        toast({
          title: "Aguardando pagamento",
          description: `Status: ${response.data.status}`,
        });
      }
    } catch (error: any) {
      toast({
        title: "Erro ao verificar",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setCheckingPayment(false);
    }
  };

  const handleClose = () => {
    setPaymentData(null);
    setAmount("");
    setCopied(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Adicionar Saldo</DialogTitle>
          <DialogDescription>
            {paymentData ? "Complete o pagamento abaixo" : "Escolha o valor e forma de pagamento"}
          </DialogDescription>
        </DialogHeader>

        {!paymentData ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="amount">Valor (R$)</Label>
              <Input
                id="amount"
                type="number"
                min="5"
                step="0.01"
                placeholder="Mínimo R$ 5,00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Forma de Pagamento</Label>
              <RadioGroup
                value={billingType}
                onValueChange={(v) => setBillingType(v as "PIX" | "BOLETO")}
                className="grid grid-cols-2 gap-4"
              >
                <div className="relative">
                  <RadioGroupItem value="PIX" id="pix" className="peer sr-only" />
                  <Label
                    htmlFor="pix"
                    className="flex flex-col items-center justify-center p-4 rounded-lg border-2 border-border bg-background/50 cursor-pointer hover:border-primary/50 peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/10 transition-colors"
                  >
                    <QrCode className="w-6 h-6 mb-2 text-primary" />
                    <span className="font-medium">PIX</span>
                    <span className="text-xs text-muted-foreground">Instantâneo</span>
                  </Label>
                </div>

                <div className="relative">
                  <RadioGroupItem value="BOLETO" id="boleto" className="peer sr-only" />
                  <Label
                    htmlFor="boleto"
                    className="flex flex-col items-center justify-center p-4 rounded-lg border-2 border-border bg-background/50 cursor-pointer hover:border-primary/50 peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/10 transition-colors"
                  >
                    <span className="text-2xl mb-2">📄</span>
                    <span className="font-medium">Boleto</span>
                    <span className="text-xs text-muted-foreground">1-3 dias</span>
                  </Label>
                </div>
              </RadioGroup>
            </div>

            <Button
              className="w-full"
              onClick={handleCreatePayment}
              disabled={loading}
            >
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Gerar Pagamento
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {paymentData.pixQrCode && (
              <div className="flex flex-col items-center gap-4">
                <div className="bg-white p-4 rounded-lg">
                  <img
                    src={`data:image/png;base64,${paymentData.pixQrCode}`}
                    alt="QR Code PIX"
                    className="w-48 h-48"
                  />
                </div>
                
                {paymentData.pixCopyPaste && (
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={handleCopyPix}
                  >
                    {copied ? (
                      <CheckCircle2 className="w-4 h-4 mr-2 text-green-500" />
                    ) : (
                      <Copy className="w-4 h-4 mr-2" />
                    )}
                    {copied ? "Copiado!" : "Copiar código PIX"}
                  </Button>
                )}
              </div>
            )}

            {paymentData.bankSlipUrl && (
              <Button
                variant="outline"
                className="w-full"
                onClick={() => window.open(paymentData.bankSlipUrl, "_blank")}
              >
                📄 Visualizar Boleto
              </Button>
            )}

            <Button
              className="w-full"
              onClick={handleCheckPayment}
              disabled={checkingPayment}
            >
              {checkingPayment && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Verificar Pagamento
            </Button>

            <p className="text-xs text-center text-muted-foreground">
              O saldo será adicionado automaticamente após a confirmação do pagamento
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
