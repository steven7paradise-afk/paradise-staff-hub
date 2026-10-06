"use client";
import { createContext, useContext } from "react";
import { UserRound } from "lucide-react";
import { resolveDrivePhotoUrl } from "@/lib/photo-url";
export const StaffDirectoryContext = createContext<{id:string; name:string; photoUrl:string|null}[]>([]);
export function StaffIdentity({ name }: { name: string }) {
  const directory = useContext(StaffDirectoryContext);
  const matches = directory.filter(person => person.name.trim().toLocaleLowerCase("it-IT") === name.trim().toLocaleLowerCase("it-IT"));
  const person = matches.length === 1 ? matches[0] : undefined;
  return <span className="inline-flex min-w-0 items-center gap-2"><span className="grid size-8 shrink-0 place-items-center overflow-hidden rounded-full bg-pink-50">{person?.photoUrl ? <img src={resolveDrivePhotoUrl(person.photoUrl)} alt="" className="size-full object-cover" /> : <UserRound className="size-4 text-neutral-400" />}</span><span className="text-xs font-semibold text-[#302c2e]">{name}</span></span>;
}
