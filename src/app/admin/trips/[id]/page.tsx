import { TripEditor } from "@/components/admin/TripEditor";

export default async function EditTripPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <TripEditor tripId={id} />;
}
