#include<iostream>
using namespace std;

int main(){
    
   int numeros_verificados;
   int numeros;
   double soma = 0;
   double quantidade = 0;
   cin >> numeros_verificados;
   
   
   for(int i = 0; i < numeros_verificados;i++){
       cin >> numeros;
       
       if(numeros % 2 == 0){
           soma += numeros;
           quantidade++;
           
           cout << " numeros pares" << endl;
           
       }else if(numeros % 2 != 0){
           soma += numeros;
           quantidade++;
           
           cout << " numeros impares" << endl;
           
       }else if( numeros > 0){
           soma += numeros;
           
           cout << " numeros positivos" << endl;
           
       }else{
           cout << " numeros negativos" << endl;
       }
       
       cout << soma << endl;
           
     }
     
     return 0;
   }
    
