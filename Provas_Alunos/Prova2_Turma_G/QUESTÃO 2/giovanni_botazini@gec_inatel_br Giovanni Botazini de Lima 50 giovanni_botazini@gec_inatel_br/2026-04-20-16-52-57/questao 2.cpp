#include<iostream>
#include<iomanip>
using namespace std;

int main(){
    
    int numeros_verificados;
    int numeros;
    double media= 0;
    double soma = 0;
    int quantidade;
    cin >> numeros_verificados;
    
    for(int i = 0; i < numeros_verificados;i++){
        cin >> numeros;
        
        if(numeros != 0){
             soma += numeros;
                quantidade++;
     }
        
  }
  
    if(quantidade == 0){
      cout << "0.00" << endl;
  }
  
     media = soma / numeros;
    cout << fixed << setprecision(4) << media << endl;
}