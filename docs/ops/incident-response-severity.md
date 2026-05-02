# Incident Response Severity Levels & Communication Channels

## Severity Classification

### Critical (SEV-0)
**Definition:** Service completely unavailable, security breach, or fund loss risk
**Response Time:** < 15 minutes
**Escalation:** Immediate PagerDuty to all on-call engineers
**Duration:** Resolved within 1 hour or escalate to leadership

**Examples:**
- Wallet service completely down
- Contract security vulnerability with fund loss risk
- Relayer transaction processing stopped
- Indexer sync stalled > 30 minutes
- Unauthorized access to production systems

### High (SEV-1)
**Definition:** Major service degradation, significant user impact
**Response Time:** < 30 minutes
**Escalation:** PagerDuty to on-call engineer
**Duration:** Resolved within 4 hours

**Examples:**
- Wallet service degraded > 50% error rate
- Relayer transaction failure rate > 20%
- Indexer sync lag > 15 minutes
- Contract upgrade failures
- Database performance issues

### Medium (SEV-2)
**Definition:** Minor service degradation, limited user impact
**Response Time:** < 2 hours
**Escalation:** Slack #ancore-alerts
**Duration:** Resolved within 24 hours

**Examples:**
- Wallet service degraded < 20% error rate
- Relayer increased latency > 2x baseline
- Indexer sync lag < 15 minutes
- Contract performance degradation
- Monitoring/alerting system issues

### Low (SEV-3)
**Definition:** Informational issues, no user impact
**Response Time:** < 24 hours
**Escalation:** Slack #ancore-alerts (non-urgent)
**Duration:** Resolved within 72 hours

**Examples:**
- Minor performance degradation
- Documentation issues
- Non-critical bug reports
- Maintenance notifications

## Communication Channels

### Internal Communication

#### PagerDuty
- **Trigger:** Critical and High severity incidents
- **Recipients:** On-call engineers based on service ownership
- **Escalation:** Automatic escalation to backup and leadership
- **Integration:** Direct integration with monitoring systems

#### Slack Channels
- **#ancore-alerts:** Primary alert channel for all severities
- **#incident-[timestamp]:** Incident-specific coordination channel
- **#ancore-security:** Security incident coordination
- **#ancore-ops:** Operational issues and maintenance

#### Email Distribution
- **oncall@ancore.org:** On-call engineer notifications
- **security@ancore.org:** Security incident reports
- **leadership@ancore.org:** Executive notifications for critical incidents

### External Communication

#### Status Page
- **Platform:** status.ancore.org
- **Update Frequency:** Every 15 minutes for critical incidents
- **Content:** Service status, impact assessment, resolution timeline

#### User Notifications
- **In-App:** Real-time notifications for active users
- **Email:** Critical incident notifications to all users
- **Twitter/X:** Public status updates for widespread issues
- **Telegram:** Community channel announcements

#### Public Communications
- **Blog Post:** Post-mortem analysis for critical incidents
- **Security Advisory:** Detailed security incident reports
- **GitHub Issues:** Public tracking of resolved incidents

## Communication Templates

### Critical Incident Initial Response
```
🚨 CRITICAL INCIDENT DECLARED 🚨

Service: [Service Name]
Severity: Critical (SEV-0)
Impact: [Brief impact description]
Started: [Timestamp]
Incident Channel: #incident-[timestamp]

Next Update: 15 minutes

Response Team: [Team members]
```

### High Incident Initial Response
```
⚠️ HIGH SEVERITY INCIDENT ⚠️

Service: [Service Name]
Severity: High (SEV-1)
Impact: [Brief impact description]
Started: [Timestamp]
Incident Channel: #incident-[timestamp]

Next Update: 30 minutes

On-call: [Engineer name]
```

### Status Page Update
```
Service Status: [Service Name] - [Status]

We are investigating reports of [issue description]. 
Users may experience [impact description].

Started: [Timestamp]
Impact: [Number of users affected]
Next Update: [Time]

Updates will be posted here as more information becomes available.
```

### User Notification
```
Ancore Service Alert

We're currently experiencing issues with [service name]. 
You may notice [user impact description].

Our team is actively working to resolve this issue. 
We apologize for any inconvenience and appreciate your patience.

For real-time updates: status.ancore.org
```

## Escalation Paths

### Technical Escalation
1. **On-call Engineer** (0-15 minutes)
2. **Service Lead** (15-30 minutes)
3. **Platform Lead** (30-60 minutes)
4. **CTO** (60+ minutes)

### Security Escalation
1. **On-call Security Engineer** (Immediate)
2. **Security Lead** (5 minutes)
3. **CTO/CEO** (15 minutes)
4. **Legal Counsel** (30 minutes if data breach)

### Executive Escalation
1. **Engineering Leadership** (30 minutes)
2. **CEO** (1 hour)
3. **Board of Directors** (2 hours for critical incidents)

## Communication Cadence

### Critical Incidents
- **0 minutes:** Initial alert and incident channel creation
- **15 minutes:** First status update
- **30 minutes:** Second status update or resolution
- **60 minutes:** Leadership escalation if unresolved
- **Every 30 minutes:** Continued updates until resolution

### High Incidents
- **0 minutes:** Initial alert and incident channel creation
- **30 minutes:** First status update
- **1 hour:** Second status update or resolution
- **2 hours:** Escalation if unresolved
- **Every hour:** Continued updates until resolution

### Medium/Low Incidents
- **0 minutes:** Initial alert
- **2 hours:** Status update or resolution
- **24 hours:** Final resolution or escalation

## After-Hours Communication

### On-Call Coverage
- **Primary:** 24/7 on-call rotation
- **Backup:** Secondary on-call for escalation
- **Leadership:** Executive on-call for critical incidents

### Weekend/Holiday Procedures
- **Same escalation paths** as weekdays
- **Extended response times** for non-critical incidents
- **Executive notification** for any critical incident

### Time Zone Considerations
- **Global coverage** with staggered on-call schedules
- **Regional handoffs** during business hours
- **Emergency contacts** for all time zones

## Communication Best Practices

### Do's
- Be transparent about impact and timeline
- Provide regular updates even if no progress
- Use clear, non-technical language for user communications
- Document all decisions and actions
- Include estimated resolution times when possible

### Don'ts
- Don't speculate on root causes without evidence
- Don't promise specific resolution times without confidence
- Don't use technical jargon in user-facing communications
- Don't downplay the severity or impact
- Don't share sensitive internal information publicly

## Review and Improvement

### Monthly Reviews
- Analyze incident response times
- Review communication effectiveness
- Update templates and procedures
- Conduct team training sessions

### Quarterly Drills
- Simulate critical incident scenarios
- Test communication channels and escalation paths
- Evaluate team coordination and decision-making
- Update procedures based on lessons learned

### Annual Audits
- Complete review of incident response procedures
- External audit of security incident handling
- Update communication strategies based on industry best practices
- Certify team competency in incident response
