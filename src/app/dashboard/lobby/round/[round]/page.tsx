import { notFound } from "next/navigation";
import { LobbyPage } from "../../shared";

export default async function LobbyRoundPage({
  params,
}: {
  params: Promise<{ round: string }>;
}) {
  const { round: roundStr } = await params;
  const round = Number(roundStr);
  if (!Number.isFinite(round) || round < 1) notFound();
  return <LobbyPage round={round} />;
}
