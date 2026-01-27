import { Review } from "@/lib/types";
import { getSourceById } from "@/lib/mock/sources";

export function exportToCSV(reviews: Review[], filename: string = "reviews") {
  // Define CSV headers
  const headers = [
    "ID",
    "Date",
    "Source",
    "Rating",
    "Sentiment",
    "Sentiment Score",
    "Title",
    "Content",
    "Author",
    "Responded",
    "Branch ID",
  ];

  // Convert reviews to CSV rows
  const rows = reviews.map((review) => {
    const source = getSourceById(review.source);
    return [
      review.id,
      new Date(review.date).toLocaleDateString("en-US"),
      source.name,
      review.rating.toString(),
      review.sentiment,
      review.sentimentScore.toFixed(1),
      `"${review.title.replace(/"/g, '""')}"`,
      `"${review.content.replace(/"/g, '""')}"`,
      review.author,
      review.responded ? "Yes" : "No",
      review.branchId,
    ];
  });

  // Build CSV content
  const csvContent = [
    headers.join(","),
    ...rows.map((row) => row.join(",")),
  ].join("\n");

  // Create blob and download
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);

  link.setAttribute("href", url);
  link.setAttribute("download", `${filename}_${new Date().toISOString().split("T")[0]}.csv`);
  link.style.visibility = "hidden";

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}
