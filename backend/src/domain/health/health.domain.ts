interface IHealthRepository {
  checkReadiness: () => Promise<void>;
}

function healthDomainFactory(ports: { healthRepository: IHealthRepository }) {
  const { healthRepository } = ports;

  return {
    async readiness(): Promise<void> {
      await healthRepository.checkReadiness();
    },
  };
}

export default healthDomainFactory;
