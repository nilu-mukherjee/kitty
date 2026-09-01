import OrderClient from "./OrderClient";

export default async function OrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ host?: string }>;
}) {
  const { id } = await params;
  const { host } = await searchParams;
  return <OrderClient sessionId={id} hostTokenFromUrl={host ?? null} />;
}
