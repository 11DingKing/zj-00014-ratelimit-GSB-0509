import * as grpc from "@grpc/grpc-js";
import * as protoLoader from "@grpc/proto-loader";
import path from "path";
import { config } from "../config";
import { checkService } from "../services/checkService";

const PROTO_PATH = path.join(__dirname, "../../proto/ratelimit.proto");

const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});

const ratelimitProto = grpc.loadPackageDefinition(packageDefinition)
  .ratelimit as any;

async function check(
  call: grpc.ServerUnaryCall<any, any>,
  callback: grpc.sendUnaryData<any>,
) {
  const { resource, subject, quota } = call.request;

  try {
    const result = await checkService.check({
      consumer: subject,
      api: resource,
      custom: quota,
    });

    callback(null, {
      allowed: result.allowed,
      remaining: result.remaining,
    });
  } catch (error) {
    callback(error as grpc.ServiceError);
  }
}

export function startGrpcServer(): grpc.Server {
  const server = new grpc.Server();

  server.addService(ratelimitProto.RateLimitService.service, {
    check,
  });

  return server;
}

export function bindGrpcServer(server: grpc.Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.bindAsync(
      `0.0.0.0:${config.grpcPort}`,
      grpc.ServerCredentials.createInsecure(),
      (err, port) => {
        if (err) {
          reject(err);
          return;
        }
        console.log(`gRPC server bound on port ${port}`);
        resolve();
      },
    );
  });
}
