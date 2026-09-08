export function isFinalTaskStatus(status: string) {
  return ["COMPLETED", "DONE"].includes(status.trim().toUpperCase());
}

export function canRequestTaskCompletion(input: { isAssignee: boolean; currentStatus: string }) {
  return input.isAssignee
    && !isFinalTaskStatus(input.currentStatus)
    && input.currentStatus.trim().toUpperCase() !== "COMPLETION_REQUESTED";
}

export function canDecideTaskCompletion(input: {
  userId: string;
  role: string;
  createdById: string;
  currentStatus: string;
}) {
  return (input.userId === input.createdById || input.role === "ZERO")
    && input.currentStatus.trim().toUpperCase() === "COMPLETION_REQUESTED";
}
