import { Construct, Stack, StackProps, CfnOutput } from '@aws-cdk/core';
import { Vpc, InstanceType, InstanceClass, InstanceSize, SecurityGroup, Peer, Port } from '@aws-cdk/aws-ec2';
import { Tag } from '@aws-cdk/core';
import { Cluster, ContainerImage, TaskDefinition, Compatibility, LogDriver, Ec2Service } from '@aws-cdk/aws-ecs'
import path = require('path');
import { ApplicationLoadBalancer, ApplicationTargetGroup } from '@aws-cdk/aws-elasticloadbalancingv2';
import { AutoScalingGroup } from '@aws-cdk/aws-autoscaling';

export interface ChallongeCdkStackProps extends StackProps {
  vpc: Vpc;
}


export class ChallongeCdkStack extends Stack {
  constructor(scope: Construct, id: string, props: ChallongeCdkStackProps) {
    super(scope, id, props);

    const tags = props.tags || {};
    const vpc = props.vpc;
    const resources: Construct[] = [];

    // The code that defines your stack goes here

    const cluster = new Cluster(this, 'ChallongeApiCluster', { vpc, clusterName: 'challonge-api-cluster' });

    const asg = cluster.addCapacity('ChallongeApiAutoscalingGroup', {
      instanceType: InstanceType.of(InstanceClass.T3, InstanceSize.MICRO),
      keyName: 'mac-mini-cds',
    });
    const secGroup = new SecurityGroup(this, 'AllowSSH', { vpc });
    secGroup.addIngressRule(Peer.anyIpv4(), Port.tcp(22), 'Allow ssh')
    asg.addSecurityGroup(secGroup);

    const lb = this.createLoadBalancer(vpc, asg, resources);

    const taskDefinition = new TaskDefinition(this, 'ChallongeApiTask', {
      compatibility: Compatibility.EC2,
    });

    const container = taskDefinition.addContainer('challonge-api', {
      image: ContainerImage.fromAsset(path.join(__dirname, '..', '..', 'challonge')),
      environment: {
        NODE_ENV: 'production',
        DATABASE_URL: 'postgres://ncmrbozhvgamtm:8b4c32cffce72bc607ddb70eeb5f05babd549efa3ffa38c2229f0ebf1296efb4@ec2-54-225-72-238.compute-1.amazonaws.com:5432/dd1vtcu80a58u2',
        API_KEY: '7F68D695-15AB-4ECB-8078-BB283C9BFC89'
      },
      memoryLimitMiB: 512,
      logging: LogDriver.awsLogs({ streamPrefix: 'challonge-api' })
    });
    container.addPortMappings({
      containerPort: 3000,
      hostPort: 80,
    });

    const service = new Ec2Service(this, 'ChallongeApiService', {
      cluster,
      taskDefinition,
    });

    resources.push(vpc, cluster, asg, taskDefinition, container, service)
    this.tagResources(resources, tags);

    // Output the DNS where you can access your service
    new CfnOutput(this, 'LoadBalancerDNS', { value: lb.loadBalancerDnsName });
  }

  private createLoadBalancer(vpc: Vpc, asg: AutoScalingGroup, resources: Construct[]) {
    const lb = new ApplicationLoadBalancer(this, 'ChallongeApiLoadBalancer', {
      vpc,
      internetFacing: true
    });
    const httpListener = lb.addListener('HTTPListener', {
      port: 80,
    })
    const httpsListener = lb.addListener('HTTPSListener', {
      port: 443,
      certificateArns: ['arn:aws:acm:us-east-1:912040674530:certificate/939f3348-b28d-4d34-94ad-0b4319f89f45']
    })

    const targetGroup = new ApplicationTargetGroup(this, 'ChallongeApiAsgTargetGroup', {
      vpc,
      targets: [asg],
      port: 80
    })
    httpListener.addTargetGroups('ChallongeApiAsgTargetGroup', {
      targetGroups: [targetGroup]
    })
    httpsListener.addTargetGroups('ChallongeApiAsgTargetGroup', {
      targetGroups: [targetGroup]
    })

    // const zone = HostedZone.fromLookup(this, 'ChallongeApiHostedZone', { domainName: 'jsanguinetti.tk', vpcId: vpc.vpcId });

    // new ARecord(this, 'ChallongeApiElbDns', {
    //   zone,
    //   recordName: 'api.jsanguinetti.tk',
    //   target: AddressRecordTarget.fromAlias({
    //     bind: (): AliasRecordTargetConfig => ({
    //       dnsName: lb.loadBalancerDnsName,
    //       hostedZoneId: zone.hostedZoneId,
    //     })
    //   })
    // })


    resources.push(lb, httpListener, httpsListener, targetGroup)

    return lb;
  }

  private tagResources(resources: Construct[], tags: { [key: string]: string }) {
    const tagResource = (tag: Tag) => (resource: Construct) => resource.node.applyAspect(tag);
    Object.getOwnPropertyNames(tags)
      .map(tagKey => new Tag(tagKey, tags[tagKey]))
      .forEach(tag => resources.forEach(tagResource(tag)));
  }
}
