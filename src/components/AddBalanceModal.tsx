import { useState, useEffect, ChangeEvent } from "react";
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

// Valores pré-definidos para adicionar saldo
const PREDEFINED_AMOUNTS = [
  { value: 10, label: "R$ 10,00" },
  { value: 25, label: "R$ 25,00" },
  { value: 50, label: "R$ 50,00" },
  { value: 100, label: "R$ 100,00" },
  { value: 200, label: "R$ 200,00" },
];

export function AddBalanceModal({ open, onOpenChange, onSuccess }: AddBalanceModalProps) {
  const [cpf, setCpf] = useState("");
  const [amount, setAmount] = useState("");
  const [selectedAmount, setSelectedAmount] = useState<number | null>(null);
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

  // Função para formatar CPF
  const formatCpf = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 11);
    return digits
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
  };

  // Função para validar CPF
  const validateCpf = (cpf: string) => {
    const cleanCpf = cpf.replace(/\D/g, '');
    if (cleanCpf.length !== 11) return false;

    // Verificar se todos os dígitos são iguais
    if (/^(\d)\1+$/.test(cleanCpf)) return false;

    let sum = 0;
    let remainder;

    // Validar primeiro dígito
    for (let i = 1; i <= 9; i++) {
      sum += parseInt(cleanCpf.substring(i - 1, i)) * (11 - i);
    }
    remainder = (sum * 10) % 11;
    if (remainder === 10 || remainder === 11) remainder = 0;
    if (remainder !== parseInt(cleanCpf.substring(9, 10))) return false;

    // Validar segundo dígito
    sum = 0;
    for (let i = 1; i <= 10; i++) {
      sum += parseInt(cleanCpf.substring(i - 1, i)) * (12 - i);
    }
    remainder = (sum * 10) % 11;
    if (remainder === 10 || remainder === 11) remainder = 0;
    if (remainder !== parseInt(cleanCpf.substring(10, 11))) return false;

    return true;
  };

  // Atualizar CPF formatado
  const handleCpfChange = (e: ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCpf(e.target.value);
    setCpf(formatted);
  };

  // Selecionar valor pré-definido
  const handleSelectAmount = (value: number) => {
    setSelectedAmount(value);
    setAmount(value.toString());
  };

  // Limpar seleção de valor
  const handleAmountChange = (e: ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value === "" || /^\d*\.?\d*$/.test(value)) {
      setAmount(value);
      setSelectedAmount(null);
    }
  };

  const handleCreatePayment = async () => {
    // Validar CPF
    const cleanCpf = cpf.replace(/\D/g, '');
    if (!cleanCpf || cleanCpf.length !== 11) {
      toast({
        title: "CPF inválido",
        description: "Por favor, informe um CPF válido",
        variant: "destructive",
      });
      return;
    }

    if (!validateCpf(cleanCpf)) {
      toast({
        title: "CPF inválido",
        description: "O CPF informado não é válido",
        variant: "destructive",
      });
      return;
    }

    // Validar valor
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
      
      // Atualizar CPF do usuário
      if (session?.user?.id) {
        const { error: updateError } = await supabase
          .from("profiles")
          .update({ cpf: cleanCpf })
          .eq("id", session.user.id);
        
        if (updateError) {
          console.error("Erro ao atualizar CPF:", updateError);
        }
      }

      const response = await supabase.functions.invoke("asaas-create-payment", {
        body: { 
          amount: value, 
          billingType,
          cpf: cleanCpf
        },
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
    setSelectedAmount(null);
    setCpf("");
    setCopied(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Adicionar Saldo</DialogTitle>
          <DialogDescription>
            {paymentData ? "Complete o pagamento abaixo" : "Informe seu CPF e escolha o valor"}
          </DialogDescription>
        </DialogHeader>

        {!paymentData ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="cpf">CPF</Label>
              <Input
                id="cpf"
                type="text"
                placeholder="Ex: 123.456.789-00"
                value={cpf}
                onChange={handleCpfChange}
              />
            </div>

            <div className="space-y-2">
              <Label>Valor (R$)</Label>
              {/* Valores pré-definidos */}
              <div className="grid grid-cols-3 gap-2">
                {PREDEFINED_AMOUNTS.map((option) => (
                  <Button
                    key={option.value}
                    variant={selectedAmount === option.value ? "default" : "outline"}
                    onClick={() => handleSelectAmount(option.value)}
                    className="h-12"
                  >
                    {option.label}
                  </Button>
                ))}
              </div>
              
              {/* Input para valor personalizado */}
              <div className="relative mt-2">
                <Input
                  id="amount"
                  type="text"
                  placeholder="Ou informe um valor personalizado"
                  value={amount}
                  onChange={handleAmountChange}
                  className="pl-8"
                />
                <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground">R$</span>
              </div>
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