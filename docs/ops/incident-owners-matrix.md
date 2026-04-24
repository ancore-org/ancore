# Incident Response Owners Matrix

## Service Ownership

### Core Services

| Service | Primary Owner | Backup Owner | Escalation Lead | On-Call Rotation |
|---------|---------------|--------------|-----------------|------------------|
| **Wallet Services** | @wallet-lead | @wallet-senior | @platform-lead | wallet-oncall |
| **Relayer Service** | @relayer-lead | @relayer-senior | @platform-lead | relayer-oncall |
| **Indexer Service** | @indexer-lead | @indexer-senior | @platform-lead | indexer-oncall |
| **Smart Contracts** | @contracts-lead | @security-lead | @cto | contracts-oncall |
| **Infrastructure** | @platform-lead | @infra-senior | @cto | infra-oncall |

### Supporting Services

| Service | Primary Owner | Backup Owner | Escalation Lead | On-Call Rotation |
|---------|---------------|--------------|-----------------|------------------|
| **Database** | @dba-lead | @platform-lead | @cto | dba-oncall |
| **Monitoring** | @observability-lead | @platform-lead | @cto | observability-oncall |
| **Security** | @security-lead | @security-senior | @cto | security-oncall |
| **Network** | @network-lead | @infra-senior | @cto | network-oncall |

## Incident Type Ownership

### Critical Incidents (SEV-0)

| Incident Type | Primary Owner | Decision Maker | Communication Lead |
|---------------|--------------|----------------|-------------------|
| **Security Breach** | @security-lead | @cto | @comms-lead |
| **Fund Loss Risk** | @contracts-lead | @cto | @comms-lead |
| **Service Outage** | @platform-lead | @cto | @comms-lead |
| **Data Corruption** | @dba-lead | @cto | @comms-lead |
| **Infrastructure Failure** | @infra-lead | @cto | @comms-lead |

### High Severity Incidents (SEV-1)

| Incident Type | Primary Owner | Decision Maker | Communication Lead |
|---------------|--------------|----------------|-------------------|
| **Service Degradation** | Service Owner | Service Lead | Service Owner |
| **Performance Issues** | Service Owner | Platform Lead | Service Owner |
| **Upgrade Failures** | Service Owner | Service Lead | Service Owner |
| **Database Issues** | @dba-lead | Platform Lead | @dba-lead |
| **Network Issues** | @network-lead | Platform Lead | @network-lead |

### Medium/Low Incidents (SEV-2/3)

| Incident Type | Primary Owner | Decision Maker | Communication Lead |
|---------------|--------------|----------------|-------------------|
| **Minor Issues** | Service Owner | Service Owner | Service Owner |
| **Maintenance** | Service Owner | Service Owner | Service Owner |
| **Monitoring Alerts** | @observability-lead | Platform Lead | @observability-lead |

## Escalation Matrix

### Technical Escalation

| Level | Trigger | Escalate To | Time Limit |
|-------|---------|-------------|------------|
| **L1** | Initial incident | Service Owner | 0 minutes |
| **L2** | Unresolved > 15min | Service Lead | 15 minutes |
| **L3** | Unresolved > 30min | Platform Lead | 30 minutes |
| **L4** | Unresolved > 60min | CTO | 60 minutes |
| **L5** | Unresolved > 2hrs | CEO | 2 hours |

### Security Escalation

| Level | Trigger | Escalate To | Time Limit |
|-------|---------|-------------|------------|
| **L1** | Security incident detected | Security On-Call | Immediate |
| **L2** | Potential breach | Security Lead | 5 minutes |
| **L3** | Confirmed breach | CTO/CEO | 15 minutes |
| **L4** | Data breach | Legal Counsel | 30 minutes |
| **L5** | Regulatory impact | Board | 1 hour |

### Business Escalation

| Level | Trigger | Escalate To | Time Limit |
|-------|---------|-------------|------------|
| **L1** | User impact > 1000 | Product Lead | 30 minutes |
| **L2** | Revenue impact > $10k | Head of Product | 1 hour |
| **L3** | Regulatory issues | Legal Counsel | 2 hours |
| **L4** | Media attention | CEO/Comms | Immediate |

## On-Call Schedule

### Weekly Rotation

| Week | Primary On-Call | Backup On-Call | Escalation |
|------|------------------|----------------|------------|
| **Week 1** | @engineer-a | @engineer-b | @platform-lead |
| **Week 2** | @engineer-c | @engineer-d | @platform-lead |
| **Week 3** | @engineer-e | @engineer-f | @platform-lead |
| **Week 4** | @engineer-g | @engineer-h | @platform-lead |

### Service-Specific On-Call

| Service | Primary | Backup | Coverage |
|---------|---------|---------|----------|
| **Wallet** | @wallet-oncall | @wallet-backup | 24/7 |
| **Relayer** | @relayer-oncall | @relayer-backup | 24/7 |
| **Indexer** | @indexer-oncall | @indexer-backup | 24/7 |
| **Contracts** | @contracts-oncall | @security-oncall | Business hours |
| **Infrastructure** | @infra-oncall | @infra-backup | 24/7 |

## Contact Information

### Emergency Contacts

| Role | Slack | Phone | Email |
|------|-------|-------|-------|
| **CTO** | @cto | +1-XXX-XXX-XXXX | cto@ancore.org |
| **Platform Lead** | @platform-lead | +1-XXX-XXX-XXXX | platform@ancore.org |
| **Security Lead** | @security-lead | +1-XXX-XXX-XXXX | security@ancore.org |
| **Product Lead** | @product-lead | +1-XXX-XXX-XXXX | product@ancore.org |

### Team Contacts

| Team | Slack Channel | Email | On-Call |
|------|---------------|-------|----------|
| **Wallet** | #wallet-team | wallet@ancore.org | @wallet-oncall |
| **Relayer** | #relayer-team | relayer@ancore.org | @relayer-oncall |
| **Indexer** | #indexer-team | indexer@ancore.org | @indexer-oncall |
| **Contracts** | #contracts-team | contracts@ancore.org | @contracts-oncall |
| **Infrastructure** | #infra-team | infra@ancore.org | @infra-oncall |
| **Security** | #security-team | security@ancore.org | @security-oncall |

## Decision Authority

### Critical Decisions

| Decision | Authority | Backup | Consultation Required |
|----------|-----------|---------|----------------------|
| **Service Shutdown** | CTO | Platform Lead | Legal, Product |
| **Emergency Deploy** | Service Lead | Platform Lead | Security, QA |
| **Public Disclosure** | CEO | CTO | Legal, Comms |
| **Fund Recovery** | CTO | Contracts Lead | Legal, Security |
| **Data Restoration** | DBA Lead | Platform Lead | Security, Legal |

### Financial Decisions

| Decision | Authority | Amount | Approval Required |
|----------|-----------|--------|-------------------|
| **Emergency Spending** | CTO | <$10k | None |
| **Emergency Spending** | CEO | <$50k | Board notification |
| **Emergency Spending** | Board | >$50k | Full approval |
| **Compensation** | CEO | Variable | Legal, Finance |

### Communication Decisions

| Decision | Authority | Timing | Channels |
|----------|-----------|--------|----------|
| **Internal Alerts** | Incident Commander | Immediate | Slack, PagerDuty |
| **Status Page** | Comms Lead | <15 minutes | status.ancore.org |
| **User Notifications** | Product Lead | <30 minutes | In-app, Email |
| **Public Statements** | CEO | As needed | Twitter, Blog |
| **Regulatory Notices** | Legal | As required | Regulatory bodies |

## Handoff Procedures

### Shift Handoff

1. **Pre-Handoff Checklist:**
   - Review active incidents
   - Check system health
   - Verify monitoring status
   - Document ongoing issues

2. **Handoff Meeting:**
   - Discuss active incidents
   - Review recent changes
   - Identify potential issues
   - Confirm contact availability

3. **Post-Handoff:**
   - Update handoff document
   - Notify team of change
   - Monitor for transition issues
   - Confirm all alerts routed correctly

### Incident Handoff

1. **Context Transfer:**
   - Incident summary
   - Actions taken
   - Current status
   - Next steps

2. **System Access:**
   - Shared terminals
   - Incident channel access
   - Tool credentials
   - Monitoring dashboards

3. **Communication:**
   - Update incident channel
   - Notify stakeholders
   - Update status page
   - Document handoff

## Training and Certification

### Required Training

| Role | Training | Frequency | Certification |
|------|----------|-----------|---------------|
| **On-Call Engineers** | Incident Response | Quarterly | Certified |
| **Service Leads** | Crisis Management | Semi-annual | Certified |
| **Executives** | Communication | Annual | Certified |
| **Security Team** | Security Incident | Quarterly | Certified |

### Drill Participation

| Drill Type | Required Participants | Frequency | Success Criteria |
|------------|---------------------|-----------|------------------|
| **Tabletop Exercise** | All leads | Monthly | 90% participation |
| **Live Drill** | On-call team | Quarterly | <30min response |
| **Security Drill** | Security team | Quarterly | <15min response |
| **Full System Test** | All teams | Semi-annual | Complete success |

## Performance Metrics

### Response Time Targets

| Metric | Target | Measurement | Owner |
|--------|--------|-------------|-------|
| **Alert Acknowledgment** | <5 minutes | PagerDuty response | On-Call |
| **Incident Declaration** | <10 minutes | Channel creation | Incident Commander |
| **Status Page Update** | <15 minutes | First update | Comms Lead |
| **User Notification** | <30 minutes | First alert | Product Lead |
| **Resolution Time** | <60 minutes | Incident closure | Service Owner |

### Quality Metrics

| Metric | Target | Measurement | Owner |
|--------|--------|-------------|-------|
| **Incident Report Quality** | >95% | Review score | Service Owner |
| **Communication Clarity** | >90% | User feedback | Comms Lead |
| **Post-mortem Completion** | 100% | On-time filing | Service Owner |
| **Prevention Implementation** | >80% | Actions completed | Service Owner |

## Review and Updates

### Monthly Reviews
- Update contact information
- Review escalation performance
- Adjust ownership as needed
- Update training requirements

### Quarterly Reviews
- Complete matrix audit
- Update decision authority
- Review performance metrics
- Adjust escalation paths

### Annual Reviews
- Full ownership review
- Update organizational structure
- Revise escalation procedures
- Certify all procedures
