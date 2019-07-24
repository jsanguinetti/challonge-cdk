#!/usr/bin/env node
import 'source-map-support/register';
import cdk = require('@aws-cdk/core');
import { ChallongeCdkStack } from '../lib/challonge-cdk-stack';
import { ChallongeSlowStack } from '../lib/challonge-slow-stack';

const app = new cdk.App();

const env: cdk.Environment = {
	account: '912040674530',
	region: 'us-east-1',
}
const slowStack = new ChallongeSlowStack(app, 'SlowStack', {
	env
});
const cdkStack = new ChallongeCdkStack(app, 'CdkStack', {
	vpc: slowStack.vpc,
	tags: {
		project: 'challonge'
	},
	env
});

slowStack.tags.setTag('project', 'challonge');
cdkStack.tags.setTag('project', 'challonge');

cdkStack.addDependency(slowStack, 'SlowStack creates VPN and other resources that are slow to create');
