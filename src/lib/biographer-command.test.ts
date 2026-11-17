import { biographerCommandSchema } from './biographer-command';
const projectId = '123e4567-e89b-42d3-a456-426614174000';
const requestId = '123e4567-e89b-42d3-a456-426614174001';
describe('Biographer operational commands', () => {
  it('requires bounded free extension with a reason and retry identity', () => {
    const command = {
      operation: 'extendAllowance',
      input: { projectId, requestId, additionalSeconds: 3600, reason: 'Pilot interview extension' },
    };
    expect(biographerCommandSchema.safeParse(command).success).toBe(true);
    for (const additionalSeconds of [-1, 0, 36001])
      expect(
        biographerCommandSchema.safeParse({
          ...command,
          input: { ...command.input, additionalSeconds },
        }).success,
      ).toBe(false);
    expect(
      biographerCommandSchema.safeParse({ ...command, input: { ...command.input, reason: '' } })
        .success,
    ).toBe(false);
  });
  it('rejects bulk access changes and caller-selected actors', () => {
    expect(
      biographerCommandSchema.safeParse({
        operation: 'setLiveEnabled',
        input: { enabled: false, reason: 'Pause' },
      }).success,
    ).toBe(false);
    expect(
      biographerCommandSchema.safeParse({
        operation: 'listProjects',
        input: {},
        actor: { email: 'forged@example.com' },
      }).success,
    ).toBe(false);
  });
});
