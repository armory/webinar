import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import * as awsx from "@pulumi/awsx";

// Create an AWS resource (EC2 Instance)
const size = "m5.2xlarge";
const ec2name = "webinar-minnaker-test"

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
        //{ protocol: "tcp", fromPort: 80, toPort: 80, cidrBlocks: ["0.0.0.0/0"] },
        { protocol: "tcp", fromPort: 443, toPort: 443, cidrBlocks: ["0.0.0.0/0"] }
    ],
});

const server = new aws.ec2.Instance(ec2name, {
    instanceType: size,
    securityGroups: [ group.name ], // reference the security group resource above
    ami: amiId,
    keyName: "Sales Engineers Shared Key",
    tags: [{owner: "andrew way"}, {TTL: "2d"}, {purpose: "minnaker for webinar"}, {name: "Minnaker for Webinar"}]
});

export const publicIp = server.publicIp;
export const publicHostName = server.publicDns;