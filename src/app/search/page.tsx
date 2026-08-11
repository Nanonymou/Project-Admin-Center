import { Suspense } from "react";
import { GlobalSearchClient } from "@/components/search/global-search-client";

export default function SearchPage() {
  return (
    <Suspense fallback={null}>
      <GlobalSearchClient />
    </Suspense>
  );
}
