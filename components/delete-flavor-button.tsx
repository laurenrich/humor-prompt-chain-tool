"use client";

import { deleteHumorFlavorFromListForm } from "@/app/actions/humor";

export function DeleteFlavorButton({ flavorId }: { flavorId: string }) {
  return (
    <form action={deleteHumorFlavorFromListForm} className="inline">
      <input type="hidden" name="id" value={flavorId} />
      <button
        type="submit"
        className="inline-flex items-center rounded-full border border-red-300 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-950/40"
        onClick={(e) => {
          if (
            !confirm(
              "Delete this flavor? Related steps are removed if your database uses foreign-key cascade.",
            )
          ) {
            e.preventDefault();
          }
        }}
      >
        Delete
      </button>
    </form>
  );
}
