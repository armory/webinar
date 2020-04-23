import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import * as awsx from "@pulumi/awsx";

// Create an AWS resource (EC2 Instance)
const size = "m5.2xlarge";
const ec2name = "minnaker-webinar-annapolis"

// get latest ubuntu 18.04 Bionic from Ubuntu (099720109477)
const amiId = aws.getAmi({
    filters: [{
        name: "name",
        values: ["ubuntu/images/hvm-ssd/ubuntu-bionic-18.04-amd64-server-*"],
    }],
    owners: ["099720109477"],
    mostRecent: true,
}, { async: true }).then (ami => ami.id);

// allow ssh, http, https (from everywhere)
const group = new aws.ec2.SecurityGroup("minnaker-secgrp", {
    ingress: [
        { protocol: "tcp", fromPort: 22, toPort: 22, cidrBlocks: ["0.0.0.0/0"] },
        { protocol: "tcp", fromPort: 80, toPort: 80, cidrBlocks: ["0.0.0.0/0"] },
        { protocol: "tcp", fromPort: 443, toPort: 443, cidrBlocks: ["0.0.0.0/0"] }
    ],
    egress: [
        { protocol: "-1", fromPort: 0, toPort: 0, cidrBlocks: ["0.0.0.0/0"] }
    ]
});

// const userData = // <-- ADD THIS DEFINITION
// `#!/bin/bash
// curl -LO https://github.com/armory/minnaker/releases/latest/download/minnaker.tgz
// tar -zxvf minnaker.tgz `;

const server = new aws.ec2.Instance(ec2name, {
    instanceType: size,
    securityGroups: [ group.name ], // reference the security group resource above
    ami: amiId,
    keyName: "sharedsekey",
    associatePublicIpAddress: true,
    rootBlockDevice: {
        volumeSize: 40,
        volumeType: 'gp2',
        deleteOnTermination: true
    },
    tags: [{owner: "andrew way"}, {TTL: "2d"}, {purpose: "minnaker for webinar"}, {Name: "Minnaker for Webinar"}],
    //userData = userData
});

// Find the cert
const cert = pulumi.output(aws.acm.getCertificate({
    domain: "*.annapolis.armory.io",
    keyTypes: ["RSA_2048"],
}, { async: true }));

// create the loadbalancer to instance with cert
const elb = new aws.elb.LoadBalancer("minnaker-annapolis-elb", {
    availabilityZones: [
        "us-west-2a",
        "us-west-2b",
        "us-west-2c",
    ],
    connectionDraining: true,
    connectionDrainingTimeout: 400,
    crossZoneLoadBalancing: true,
    healthCheck: {
        healthyThreshold: 2,
        interval: 15,
        target: "TCP:80/",
        timeout: 5,
        unhealthyThreshold: 3,
    },
    idleTimeout: 400,
    instances: [server.id],
    listeners: [
        {
            instancePort: 80,
            instanceProtocol: "http",
            lbPort: 443,
            lbProtocol: "https",
            sslCertificateId: cert.arn,
        },
    ],
    tags: {
        Name: "ELB for Minnaker Webinar Annapolis",
    },
});

export const elbDNS = elb.dnsName;
export const publicIp = server.publicIp;
export const publicHostName = server.publicDns;