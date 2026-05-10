import * as grpc from "@grpc/grpc-js";
import * as protoLoader from "@grpc/proto-loader";
import path from "path";
import { checkService } from "../services/checkService";
import { config } from "../config";

const PROTO_PATH = path.join(__dirname, "../../proto/ratelimit.proto");

const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: Number,
  enums: String,
  defaults: true,
  oneofs: true,
});

const ratelimitProto = grpc.loadPackageDefinition(packageDefinition)
  .ratelimit as any;

function check(
  call: grpc.ServerUnaryCall<any, any>,
  callback: grpc.sendUnaryData<any>,
): void {
  const { resource, subject, quota } = call.request;

  if (!resource || !subject) {
    callback({
      code: grpc.status.INVALID_ARGUMENT,
      message: "resource and subject are required",
    } as any);
    return;
  }

  checkService
    .check({
      consumer: resource,
      api: subject,
      weight: quota || 1,
    })
    .then((result) => {
      callback(null, {
        allowed: result.allowed,
        remaining: result.remaining,
      });
    })
    .catch((error) => {
      callback({
        code: grpc.status.INTERNAL,
        message: error.message || "Internal error",
      } as any);
    });
}

export function startGrpcServer(): grpc.Server {
  const server = new grpc.Server();
  server.addService(ratelimitProto.RateLimitService.service, { check });

  const port = config.grpcPort;
  server.bindAsync(
    `0.0.0.0:${port}`,
    grpc.ServerCredentials.createInsecure(),
    (err, boundPort) => {
      if (err) {
        console.error("Failed to start gRPC server:", err);
        return;
      }
      console.log(`gRPC server running on port ${boundPort}`);
    },
  );

  server.start();
  return server;
}
