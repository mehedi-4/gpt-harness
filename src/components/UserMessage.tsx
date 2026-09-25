"use client";

import type { Message } from "@/lib/types";

export function UserMessage({ message }: { message: Message }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[76%] whitespace-pre-wrap rounded-[22px] bg-surface-2 px-[18px] py-2.5 text-[17px] leading-[1.4]">
        {message.content}
      </div>
    </div>
  );
}
