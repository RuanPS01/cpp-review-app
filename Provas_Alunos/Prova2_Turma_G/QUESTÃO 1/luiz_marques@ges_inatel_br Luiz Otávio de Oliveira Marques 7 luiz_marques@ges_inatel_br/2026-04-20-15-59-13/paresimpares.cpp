#include<iostream>
using namespace std;
int main(){
    int num;
    int n;
    int pares = 0,impares = 0,positivos = 0 , negativos = 0;
    cin>>n;
    for(int i = 0 ; i < n ; i++){
        cin>>num;
        
        if(num % 2 == 0){
            pares++;
        }
        if(num % 2 != 0 ){
          impares++;  
        }
        if(num <= -1){
              negativos ++;
        }
        if(num >= 1){
            positivos++;
        }
    }
    cout<<pares<<" numeros pares"<<endl;
    cout<<impares<<" numeros impares"<<endl;
    cout<<positivos<<" numeros positivos"<<endl;
    cout<<negativos<<" numeros negativos"<<endl;
    return 0;
}