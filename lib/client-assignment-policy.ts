export const isWaitingClient = (status: string) => ["IN_ATTESA", "ARRIVATO_IN_RITARDO"].includes(status.toUpperCase());
export const canRequestClient = (attendance: string | null, busy: boolean) => ["ENTRATA", "RIENTRO"].includes(attendance ?? "") && !busy;
