'use strict';

const _ = require('lodash');
const utils = require('../common/utils');
const bosh = require('../data-access-layer/bosh');
const Agent = require('../data-access-layer/service-agent');
const logger = require('../common/logger');
const errors = require('../common/errors');
const ServiceInstanceNotFound = errors.ServiceInstanceNotFound;
const BoshDirectorClient = bosh.BoshDirectorClient;
const Networks = bosh.manifest.Networks;
const BaseService = require('./BaseService');
const retry = utils.retry;
const CONST = require('../common/constants');

class BaseDirectorService extends BaseService {
  constructor(plan) {
    super(plan);
    this.plan = plan;
    this.director = bosh.director;
    this.agent = new Agent(this.settings.agent);
  }

  static parseDeploymentName(deploymentName, subnet) {
    return _
      .chain(utils.deploymentNameRegExp(subnet).exec(deploymentName))
      .slice(1)
      .tap(parts => parts[1] = parts.length ? parseInt(parts[1]) : undefined)
      .value();
  }

  getDeploymentIps(deploymentName) {
    return this.director.getDeploymentIps(deploymentName);
  }

  get template() {
    return new Buffer(this.settings.template, 'base64').toString('utf8');
  }

  findDeploymentNameByInstanceId(guid) {
    logger.info(`Finding deployment name with instance id : '${guid}'`);
    return this.getDeploymentNames(false)
      .then(deploymentNames => {
        const deploymentName = _.find(deploymentNames, name => _.endsWith(name, guid));
        if (!deploymentName) {
          logger.warn(`+-> Could not find a matching deployment for guid: ${guid}`);
          throw new ServiceInstanceNotFound(guid);
        }
        return deploymentName;
      })
      .tap(deploymentName => logger.info(`+-> Found deployment '${deploymentName}' for '${guid}'`));
  }

  getDeploymentNames(queued) {
    return this.director.getDeploymentNames(queued);
  }

  get stemcell() {
    return _(this.settings)
      .chain()
      .get('stemcell', {})
      .defaults(BoshDirectorClient.getInfrastructure().stemcell)
      .update('version', version => '' + version)
      .value();
  }

  get releases() {
    return _(this.settings)
      .chain()
      .get('releases')
      .map(release => _.pick(release, 'name', 'version'))
      .sortBy(release => `${release.name}/${release.version}`)
      .value();
  }

  get networkName() {
    return this.subnet || BoshDirectorClient.getInfrastructure().segmentation.network_name || 'default';
  }

  getNetworks(index) {
    return new Networks(BoshDirectorClient.getInfrastructure().networks, index, BoshDirectorClient.getInfrastructure().segmentation);
  }

  getNetwork(index) {
    return this.getNetworks(index)[this.networkName];
  }

  reScheduleBackup(opts) {
    const cf = require('../data-access-layer/cf');
    const options = {
      instance_id: opts.instance_id,
      repeatInterval: 'daily',
      type: CONST.BACKUP.TYPE.ONLINE
    };

    if (this.plan.service.backup_interval) {
      options.repeatInterval = this.plan.service.backup_interval;
    }

    options.repeatInterval = utils.getCronWithIntervalAndAfterXminute(options.repeatInterval, opts.afterXminute);
    logger.info(`Scheduling Backup for instance : ${options.instance_id} with backup interval of - ${options.repeatInterval}`);
    // Even if there is an error while fetching backup schedule, trigger backup schedule we would want audit log captured and riemann alert sent
    return retry(() => cf.serviceFabrikClient.scheduleBackup(options), {
      maxAttempts: 3,
      minDelay: 500
    });
  }
}

module.exports = BaseDirectorService;
