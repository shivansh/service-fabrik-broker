'use strict';

const assert = require('assert');
const CONST = require('../common/constants');
let ScheduleBackupJob, ScheduledOobDeploymentBackupJob, OperationStatusPollerJob, BackupReaperJob, ServiceInstanceUpdateJob, DbCollectionReaperJob, BluePrintJob,
  MeterInstanceJob, ArchiveMeteredEventsJob;

class JobFabrik {
  static getJob(jobType) {
    switch (jobType) {
      case CONST.JOB.SCHEDULED_BACKUP:
        if (ScheduleBackupJob === undefined) {
          ScheduleBackupJob = require('./ScheduleBackupJob');
        }
        return ScheduleBackupJob;
      case CONST.JOB.SCHEDULED_OOB_DEPLOYMENT_BACKUP:
        if (ScheduledOobDeploymentBackupJob === undefined) {
          ScheduledOobDeploymentBackupJob = require('./ScheduledOobDeploymentBackupJob');
        }
        return ScheduledOobDeploymentBackupJob;
      case CONST.JOB.OPERATION_STATUS_POLLER:
        if (OperationStatusPollerJob === undefined) {
          OperationStatusPollerJob = require('./OperationStatusPollerJob');
        }
        return OperationStatusPollerJob;
      case CONST.JOB.BLUEPRINT_JOB:
        if (BluePrintJob === undefined) {
          BluePrintJob = require('./BluePrintJob');
        }
        return BluePrintJob;
      case CONST.JOB.BACKUP_REAPER:
        if (BackupReaperJob === undefined) {
          BackupReaperJob = require('./BackupReaperJob');
        }
        return BackupReaperJob;
      case CONST.JOB.SERVICE_INSTANCE_UPDATE:
        if (ServiceInstanceUpdateJob === undefined) {
          ServiceInstanceUpdateJob = require('./ServiceInstanceUpdateJob');
        }
        return ServiceInstanceUpdateJob;
      case CONST.JOB.DB_COLLECTION_REAPER:
        if (DbCollectionReaperJob === undefined) {
          DbCollectionReaperJob = require('./DbCollectionReaperJob');
        }
        return DbCollectionReaperJob;
      case CONST.JOB.METER_INSTANCE:
        if (MeterInstanceJob === undefined) {
          MeterInstanceJob = require('./MeterInstanceJob');
        }
        return MeterInstanceJob;
      case CONST.JOB.ARCHIVE_METERED_EVENTS:
        if (ArchiveMeteredEventsJob === undefined) {
          ArchiveMeteredEventsJob = require('./ArchiveMeteredEventsJob');
        }
        return ArchiveMeteredEventsJob;
      default:
        assert.fail(jobType, [CONST.JOB.SCHEDULED_BACKUP, CONST.JOB.SERVICE_FABRIK_BACKUP, CONST.JOB.SCHEDULED_OOB_DEPLOYMENT_BACKUP, CONST.JOB.OPERATION_STATUS_POLLER, CONST.JOB.BACKUP_REAPER], `Invalid job type. ${jobType} does not exist`, 'in');
    }
  }
}

module.exports = JobFabrik;
