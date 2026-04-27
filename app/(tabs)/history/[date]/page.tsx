import { redirect } from "next/navigation";

type HistoryDayPageProps = {
  params: Promise<{ date: string }>;
};

export default async function HistoryDayPage({ params }: HistoryDayPageProps) {
  const { date } = await params;
  redirect(`/workplace/history/${date}`);
}
