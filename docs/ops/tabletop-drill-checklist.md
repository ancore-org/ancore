# Tabletop Drill Checklist

## Overview
This checklist provides structured scenarios for testing incident response capabilities through tabletop exercises. Regular drills ensure team readiness and identify gaps in procedures.

## Drill Format

### Participants Required
- **Incident Commander:** Facilitates the drill
- **Service Owners:** Represent their respective services
- **Communication Lead:** Manages internal/external communications
- **Security Lead:** Handles security aspects
- **Executive Observer:** Provides leadership perspective
- **Scribe:** Documents actions and decisions

### Drill Structure
1. **Scenario Briefing** (10 minutes)
2. **Initial Response** (15 minutes)
3. **Triage & Investigation** (20 minutes)
4. **Remediation Actions** (15 minutes)
5. **Communication & Escalation** (10 minutes)
6. **Post-Incident Review** (10 minutes)

## Drill Scenarios

### Scenario 1: Critical Wallet Service Outage

#### Setup
- **Time:** Friday 8:00 PM (off-hours)
- **Trigger:** Multiple PagerDuty alerts for wallet services
- **Impact:** Users cannot access accounts or sign transactions
- **Additional Complexity:** Recent deployment 2 hours ago

#### Drill Objectives
- Test on-call response time
- Validate deployment rollback procedures
- Practice user communication during peak usage
- Test escalation procedures

#### Evaluation Checklist
- [ ] PagerDuty alert acknowledged within 5 minutes
- [ ] Incident channel created and properly named
- [ ] Correct severity level assigned (Critical)
- [ ] Service status assessed within 10 minutes
- [ ] Deployment rollback initiated if needed
- [ ] Status page updated within 15 minutes
- [ ] User notification sent within 30 minutes
- [ ] Escalation path followed correctly
- [ ] Post-incident documentation started

#### Success Criteria
- **Response Time:** < 15 minutes to incident declaration
- **Communication:** All stakeholders notified appropriately
- **Technical:** Correct remediation actions identified
- **Process:** All steps in runbook followed

### Scenario 2: Smart Contract Security Vulnerability

#### Setup
- **Time:** Tuesday 2:00 PM (business hours)
- **Trigger:** Security team detects unusual contract behavior
- **Impact:** Potential fund loss risk for 10,000+ users
- **Additional Complexity:** Vulnerability in core account contract

#### Drill Objectives
- Test security incident response
- Validate emergency upgrade procedures
- Practice fund protection measures
- Test regulatory communication

#### Evaluation Checklist
- [ ] Security incident declared immediately
- [ ] Emergency response team activated
- [ ] Contract interactions paused within 10 minutes
- [ ] Vulnerability assessment completed
- [ ] Emergency patch deployment tested
- [ ] User fund protection measures implemented
- [ ] Legal counsel notified within 30 minutes
- [ ] Public communication strategy developed
- [ ] Regulatory bodies notified if required

#### Success Criteria
- **Response Time:** < 10 minutes to security declaration
- **Protection:** User funds secured within 30 minutes
- **Communication:** All required parties notified
- **Technical:** Emergency procedures validated

### Scenario 3: Relayer Transaction Processing Failure

#### Setup
- **Time:** Monday 9:00 AM (high traffic)
- **Trigger:** 95% transaction failure rate in relayer
- **Impact:** Users cannot submit transactions
- **Additional Complexity:** Gas fees spiking on network

#### Drill Objectives
- Test transaction failure troubleshooting
- Validate gas fee adjustment procedures
- Practice user impact assessment
- Test backup systems activation

#### Evaluation Checklist
- [ ] Transaction failure alerts acknowledged
- [ ] Root cause investigation initiated
- [ ] Gas fee adjustments tested
- [ ] Backup relayer systems activated
- [ ] User impact quantified
- [ ] Status page updated with transaction status
- [ ] Technical team coordination effective
- [ ] Resolution timeline communicated

#### Success Criteria
- **Technical:** Correct diagnosis within 20 minutes
- **Recovery:** Service restored within 45 minutes
- **Communication:** Clear status updates provided
- **Coordination:** Teams work effectively together

### Scenario 4: Indexer Data Corruption

#### Setup
- **Time:** Wednesday 3:00 AM (low traffic)
- **Trigger:** Data integrity checks fail
- **Impact:** Balance display issues for all users
- **Additional Complexity:** Last good backup 24 hours ago

#### Drill Objectives
- Test data corruption response
- Validate backup restoration procedures
- Practice partial service operation
- Test data verification processes

#### Evaluation Checklist
- [ ] Data corruption detected and confirmed
- [ ] Impact assessment completed
- [ ] Backup restoration initiated
- [ ] Partial service mode activated
- [ ] Data verification procedures followed
- [ ] User communication about balance issues
- [ ] Technical root cause investigation
- [ ] Prevention measures identified

#### Success Criteria
- **Detection:** Corruption identified within 10 minutes
- **Recovery:** Service restored within 2 hours
- **Accuracy:** Data integrity verified before restoration
- **Communication:** Users kept informed throughout

### Scenario 5: Multi-Service Cascading Failure

#### Setup
- **Time:** Thursday 11:00 AM (peak business)
- **Trigger:** Infrastructure failure affecting multiple services
- **Impact:** Wallet, relayer, and indexer all degraded
- **Additional Complexity:** Database connection pool exhaustion

#### Drill Objectives
- Test multi-service incident coordination
- Validate infrastructure recovery procedures
- Practice prioritization of services
- Test communication across multiple teams

#### Evaluation Checklist
- [ ] All service alerts correlated
- [ ] Incident command structure established
- [ ] Service prioritization determined
- [ ] Infrastructure issues diagnosed
- [ ] Recovery sequence planned
- [ ] Cross-team communication effective
- [ ] User impact minimized through prioritization
- [ ] System-wide recovery validated

#### Success Criteria
- **Coordination:** All teams working under unified command
- **Prioritization:** Critical services restored first
- **Communication:** Clear updates across all stakeholders
- **Recovery:** System restored within 90 minutes

## Monthly Drill Schedule

### Week 1: Basic Response
- **Focus:** Individual service incidents
- **Participants:** Service owners only
- **Duration:** 45 minutes
- **Goal:** Validate basic runbook execution

### Week 2: Cross-Team Coordination
- **Focus:** Multi-service incidents
- **Participants:** All service owners
- **Duration:** 60 minutes
- **Goal:** Test team coordination

### Week 3: Security Scenarios
- **Focus:** Security incidents
- **Participants:** Security team + service owners
- **Duration:** 75 minutes
- **Goal:** Validate security procedures

### Week 4: Full System Test
- **Focus:** Complex, realistic scenarios
- **Participants:** All teams + executives
- **Duration:** 90 minutes
- **Goal:** Test complete incident response

## Drill Evaluation Metrics

### Response Metrics
- **Alert Acknowledgment Time:** Target < 5 minutes
- **Incident Declaration Time:** Target < 10 minutes
- **First Status Update Time:** Target < 15 minutes
- **Resolution Time:** Varies by scenario

### Quality Metrics
- **Runbook Adherence:** Target > 90%
- **Communication Clarity:** Target > 85%
- **Decision Making Quality:** Target > 80%
- **Team Coordination:** Target > 85%

### Learning Metrics
- **Gap Identification:** Minimum 3 gaps identified
- **Improvement Actions:** Minimum 2 actions per drill
- **Knowledge Sharing:** All participants learn something new
- **Process Improvement:** At least one procedure updated

## Post-Drill Actions

### Immediate Actions (Within 24 hours)
- [ ] Complete drill evaluation form
- [ ] Document identified gaps
- [ ] Assign improvement action owners
- [ ] Update runbooks based on findings

### Short-term Actions (Within 1 week)
- [ ] Implement critical improvements
- [ ] Update training materials
- [ ] Schedule follow-up drills for weak areas
- [ ] Share lessons learned with all teams

### Long-term Actions (Within 1 month)
- [ ] Complete all improvement actions
- [ ] Update incident response procedures
- [ ] Revise escalation paths if needed
- [ ] Update training and certification requirements

## Drill Facilitation Guide

### Preparation
1. **Scenario Selection:** Choose appropriate scenario for team skill level
2. **Participant Notification:** Schedule participants 2 weeks in advance
3. **Material Preparation:** Prepare scenario briefs and evaluation forms
4. **System Setup:** Ensure all tools and channels are available

### During Drill
1. **Time Management:** Keep drill on schedule
2. **Scenario Control:** Introduce complications at appropriate times
3. **Observation:** Note team dynamics and decision making
4. **Documentation:** Record key actions and decisions

### After Drill
1. **Debrief:** Conduct immediate debrief with all participants
2. **Evaluation:** Complete formal evaluation
3. **Action Planning:** Create improvement action plan
4. **Follow-up:** Schedule implementation review

## Continuous Improvement

### Drill Evolution
- **Increasing Complexity:** Gradually increase scenario difficulty
- **Realistic Scenarios:** Base scenarios on real incidents
- **Cross-Functional:** Include more teams in drills
- **External Participants:** Include customers or partners occasionally

### Measurement
- **Trend Analysis:** Track performance over time
- **Benchmarking:** Compare against industry standards
- **Feedback Collection:** Gather participant feedback
- **ROI Analysis:** Measure impact on real incident performance

### Certification
- **Individual Certification:** Certify team members on drill participation
- **Team Certification:** Certify teams on drill performance
- **Annual Recertification:** Require annual participation
- **Expert Recognition:** Recognize top performers

## Emergency Drill Activation

### Real Incident During Drill
If a real incident occurs during a drill:
1. **Pause Drill Immediately**
2. **Switch to Real Incident Response**
3. **Document Drill State**
4. **Resume Drill Later** if appropriate

### Drill Cancellation
Drills may be cancelled for:
- Real critical incidents
- Major system maintenance
- Team availability issues
- External emergencies

### Rescheduling
Cancelled drills should be rescheduled within:
- **Critical Drills:** 1 week
- **Regular Drills:** 2 weeks
- **Full System Tests:** 1 month
