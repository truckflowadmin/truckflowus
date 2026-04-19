import { redirect } from 'next/navigation';

// Broker editing is now superadmin-only. Redirect dispatchers back to broker detail.
export default function EditBrokerPage({ params }: { params: { id: string } }) {
  redirect(`/brokers/${params.id}`);
}
