import { describe, expect, it, vi } from "vitest";
import { CommandService } from "./command.service.js";

function setup(overrides: { online?: boolean; esp2Online?: boolean; leakActive?: boolean; unacknowledged?: object | null } = {}) {
  const commandRepository = {
    create: vi.fn().mockResolvedValue({ id: "708a89b2-2f14-4cd4-a39e-e9b428b13d62", status: "PENDING" }),
    findById: vi.fn(),
    complete: vi.fn(),
    fail: vi.fn(),
    expireOlderThan: vi.fn().mockResolvedValue([]),
  };
  const stateRepository = {
    get: vi.fn().mockResolvedValue({
      deviceOnline: overrides.online ?? true,
      esp2Online: overrides.esp2Online ?? true,
      leakActive: overrides.leakActive ?? false,
    }),
    updateValveState: vi.fn(),
  };
  const leakRepository = {
    findLatestUnacknowledged: vi.fn().mockResolvedValue(overrides.unacknowledged ?? null),
    findById: vi.fn(),
    acknowledge: vi.fn(),
  };
  const publisher = { isConnected: vi.fn().mockReturnValue(true), publishCommand: vi.fn().mockResolvedValue(undefined) };
  const io = { emit: vi.fn() };
  const service = new CommandService(
    commandRepository as never,
    stateRepository as never,
    leakRepository as never,
    publisher,
    io as never,
  );
  return { service, publisher, commandRepository, leakRepository };
}

describe("CommandService", () => {
  it("publica um comando válido e mantém o estado pendente", async () => {
    const { service, publisher } = setup();
    const command = await service.requestValve("CLOSE");
    expect(command.status).toBe("PENDING");
    expect(publisher.publishCommand).toHaveBeenCalledWith(expect.objectContaining({ type: "valve.set", desiredState: "CLOSED" }));
  });

  it("bloqueia abertura durante vazamento", async () => {
    const { service, publisher } = setup({ leakActive: true });
    await expect(service.requestValve("OPEN")).rejects.toMatchObject({ code: "LEAK_ACTIVE" });
    expect(publisher.publishCommand).not.toHaveBeenCalled();
  });

  it("bloqueia abertura antes de reconhecer o último alerta", async () => {
    const { service } = setup({ unacknowledged: { id: "leak" } });
    await expect(service.requestValve("OPEN")).rejects.toMatchObject({ code: "LEAK_NOT_ACKNOWLEDGED" });
  });

  it("não cria comandos quando a central está offline", async () => {
    const { service, commandRepository } = setup({ online: false });
    await expect(service.requestValve("CLOSE")).rejects.toMatchObject({ code: "DEVICE_OFFLINE" });
    expect(commandRepository.create).not.toHaveBeenCalled();
  });

  it("bloqueia abertura quando o ESP2 está offline", async () => {
    const { service, publisher } = setup({ esp2Online: false });
    await expect(service.requestValve("OPEN")).rejects.toMatchObject({ code: "ESP2_OFFLINE" });
    expect(publisher.publishCommand).not.toHaveBeenCalled();
  });

  it("bloqueia reconhecimento durante os cinco segundos de segurança", async () => {
    const { service, leakRepository } = setup();
    leakRepository.findById.mockResolvedValue({
      id: "93acfe54-0318-4e79-8cc0-593b47b3bbb7",
      endedAt: new Date(),
      acknowledgedAt: null,
    });
    await expect(service.requestSafetyReset("93acfe54-0318-4e79-8cc0-593b47b3bbb7")).rejects.toMatchObject({
      code: "SAFETY_COOLDOWN",
    });
  });

  it("bloqueia reconhecimento quando o ESP2 está offline", async () => {
    const { service, leakRepository } = setup({ esp2Online: false });
    leakRepository.findById.mockResolvedValue({
      id: "93acfe54-0318-4e79-8cc0-593b47b3bbb7",
      endedAt: new Date(Date.now() - 10_000),
      acknowledgedAt: null,
    });
    await expect(service.requestSafetyReset("93acfe54-0318-4e79-8cc0-593b47b3bbb7")).rejects.toMatchObject({
      code: "ESP2_OFFLINE",
    });
  });

  it("envia safety.reset depois do período de segurança", async () => {
    const { service, leakRepository, publisher } = setup();
    leakRepository.findById.mockResolvedValue({
      id: "93acfe54-0318-4e79-8cc0-593b47b3bbb7",
      endedAt: new Date(Date.now() - 10_000),
      acknowledgedAt: null,
    });
    await service.requestSafetyReset("93acfe54-0318-4e79-8cc0-593b47b3bbb7");
    expect(publisher.publishCommand).toHaveBeenCalledWith(expect.objectContaining({ type: "safety.reset" }));
  });
});
