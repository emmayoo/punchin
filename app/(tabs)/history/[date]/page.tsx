import { HistoryDayDetailClient } from "@/components/history/history-day-detail-client";

type HistoryDayPageProps = {
  params: Promise<{ date: string }>;
};

export default async function HistoryDayPage({ params }: HistoryDayPageProps) {
  const { date } = await params;
  return <HistoryDayDetailClient date={date} />;
}
