import { Button } from "@/components/ui/button";
import { CustomerDetail } from "@/components/CustomerDetail";
import { ArrowLeft } from "lucide-react";
import { motion } from "framer-motion";
import { Navigate, useNavigate, useParams } from "react-router-dom";

export default function ClienteDetalhe() {
  const navigate = useNavigate();
  const { customerId } = useParams<{ customerId: string }>();

  if (!customerId) {
    return <Navigate to="/clientes" replace />;
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" className="gap-2" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Button>
      </div>

      <CustomerDetail customerId={customerId} />
    </motion.div>
  );
}