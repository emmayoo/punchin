import { BranchSelectClient } from "@/components/branch/branch-select-client";
import { ProfileNameGate } from "@/components/layout/profile-name-gate";

export default function BranchPage() {
  return (
    <>
      <ProfileNameGate />
      <BranchSelectClient />
    </>
  );
}
