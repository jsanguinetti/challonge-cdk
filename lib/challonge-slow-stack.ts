import cdk = require('@aws-cdk/core');
import ec2 = require('@aws-cdk/aws-ec2');

export class ChallongeSlowStack extends cdk.Stack {
	vpc: ec2.Vpc;

	constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
		super(scope, id, props);

		// The code that defines your stack goes here
		this.vpc = new ec2.Vpc(this, 'ChallongeVpc');
	}
}
