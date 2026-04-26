#include<iostream>
#include<iomanip>
using namespace std;
int main(){
    int n;
    float media = 0;
    int num;
    float soma = 0;
    
    cin>>n;
    
for(int i = 0 ; i < n ; i++){
    cin>>num;
    soma+=num;

    
}
media = soma / n;

cout<<fixed<<setprecision(4);
cout<<media<<endl;
return 0 ;
}