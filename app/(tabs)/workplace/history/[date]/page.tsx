import { HistoryDayDetailClient } from "@/components/history/history-day-detail-client";

type WorkplaceHistoryDayPageProps = {
  params: Promise<{ date: string }>;
};

export default async function WorkplaceHistoryDayPage({
  params,
}: WorkplaceHistoryDayPageProps) {
  const { date } = await params;
  return <HistoryDayDetailClient date={date} />;
}
