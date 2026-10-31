const STATUS_CLASSES: Record<string, string> = {
  draft: 'badge-ghost',
  active: 'badge-success',
  closed: 'badge-warning',
  archived: 'badge-neutral',
};

export default function StudyStatusBadge({ status }: { status: string }) {
  return (
    <span className={`badge badge-sm capitalize ${STATUS_CLASSES[status] ?? 'badge-outline'}`}>
      {status}
    </span>
  );
}
