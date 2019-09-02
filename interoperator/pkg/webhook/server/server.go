/*
Copyright 2018 The Service Fabrik Authors.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

package server

import (
	"io/ioutil"
	"k8s.io/client-go/util/cert"
	"os"
	"strconv"

	"github.com/cloudfoundry-incubator/service-fabrik-broker/interoperator/pkg/constants"
	"sigs.k8s.io/controller-runtime/pkg/manager"
	logf "sigs.k8s.io/controller-runtime/pkg/runtime/log"
	"sigs.k8s.io/controller-runtime/pkg/webhook"
	"sigs.k8s.io/controller-runtime/pkg/webhook/admission"
	"sigs.k8s.io/controller-runtime/pkg/webhook/admission/builder"
)

var (
	log        = logf.Log.WithName("server")
	builderMap = map[string]*builder.WebhookBuilder{}
	// HandlerMap contains all admission webhook handlers.
	HandlerMap = map[string][]admission.Handler{}
)

// Add adds itself to the manager.
func Add(mgr manager.Manager) error {
	bootstrapOpts := webhook.BootstrapOptions{}
	if _, ok := os.LookupEnv("RUN_ON_BOSH"); !ok {
		bootstrapOpts.Service = &webhook.Service{
			Namespace: func() string {
				if ns, ok := os.LookupEnv(constants.NamespaceEnvKey); !ok {
					return constants.DefaultServiceFabrikNamespace
				} else {
					return ns
				}
			}(),
			Name: "webhook-server-service",
			// Selectors should select the pod that runs this webhook server.
			Selectors: map[string]string{
				"app": "interoperator-controller-manager",
			},
		}
	}
	// NOTE: bootstrapOpts.Host will be set to "localhost" by default when
	// bootstrapOpts.Service is not initialized.
	var port int
	if p, ok := os.LookupEnv("WEBHOOK_PORT"); !ok {
		port = constants.WebhookPort
	} else {
		var err error
		port, err = strconv.Atoi(p)
		if err != nil {
			return err
		}
	}

	// Retrieve kubeconfig from mgr.getconfig and parse for certificate data.
	cfg := mgr.GetConfig()
	os.MkdirAll("/tmp/cert", os.ModePerm) // TODO: remove hardcoding
	if err := ioutil.WriteFile("/tmp/cert/ca-cert.pem", cfg.CAData, 0644); err != nil {
		return err
	}
	if err := ioutil.WriteFile("/tmp/cert/cert.pem", cfg.CertData, 0644); err != nil {
		return err
	}
	if err := ioutil.WriteFile("/tmp/cert/key.pem", cfg.KeyData, 0644); err != nil {
		return err
	}
	// Generate CA private key.
	signingKey, err := cert.NewPrivateKey()
	if err != nil {
		return err
	}
	caKey := cert.EncodePrivateKeyPEM(signingKey)
	if err := ioutil.WriteFile("/tmp/cert/ca-key.pem", caKey, 0644); err != nil {
		return err
	}

	svr, err := webhook.NewServer("admission-server", mgr, webhook.ServerOptions{
		Port: int32(port),
		// NOTE: Certificates will be auto-generated by manager on startup and
		// populated under CertDir, thus requiring write permission on the mount.
		CertDir: func() string {
			if certdir, ok := os.LookupEnv("WEBHOOK_CERT_DIR"); !ok {
				return "/tmp/cert"
			} else {
				return certdir
			}
		}(),
		BootstrapOptions: &bootstrapOpts,
		DisableWebhookConfigInstaller: func() *bool {
			disable := true
			return &disable
		}(),
	})
	if err != nil {
		return err
	}

	var webhooks []webhook.Webhook
	for k, builder := range builderMap {
		handlers, ok := HandlerMap[k]
		if !ok {
			log.Info("can't find handlers for builder", "builder name", k)
			handlers = []admission.Handler{}
		}
		wh, err := builder.
			Handlers(handlers...).
			WithManager(mgr).
			Build()
		if err != nil {
			return err
		}
		webhooks = append(webhooks, wh)
	}

	return svr.Register(webhooks...)
}